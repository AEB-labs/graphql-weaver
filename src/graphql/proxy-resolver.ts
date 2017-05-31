import {
    ASTNode, BREAK, DocumentNode, FieldNode, FragmentDefinitionNode, FragmentSpreadNode, GraphQLFieldResolver,
    GraphQLResolveInfo, GraphQLSchema, InlineFragmentNode, OperationDefinitionNode, print, SelectionSetNode, TypeInfo,
    VariableNode, visit, visitWithTypeInfo
} from 'graphql';
import { query } from './client';
import { OperationTypeNode } from '@types/graphql/language';
import { LinkConfigMap } from '../config/proxy-configuration';
import clone = require('clone');

interface ResolverConfig {
    url: string;
    operation: OperationTypeNode;
    typeRenamer?: (name: string) => string;

    /**
     * An object that maps type-field names (in the merged schema, like logistics_Delivery.country) to LinkConfigs
     */
    links?: LinkConfigMap

    transform?: (nodes: TransformData, context: TranformContext) => TransformData
}

type TransformData = { operation: OperationDefinitionNode, fragments: FragmentDefinitionNode[], variables: { [ variableName: string]: any } };
type TranformContext = { source: any, info: GraphQLResolveInfo };

export function createResolver(config: ResolverConfig): GraphQLFieldResolver<any, any> {
    return async function (source: any,
                           args: { [argName: string]: any },
                           context: any,
                           info: GraphQLResolveInfo): Promise<any> {
        const originalFragments = collectUsedFragments(info.fieldNodes, info.fragments);

        function processRoot<T extends ASTNode>(root: T): T {
            const original = root;
            root = fetchTypenameIfFragmentsPresent(root);

            if (config.links) {
                root = replaceLinksByScalarField({
                    originalRoot: {kind: 'Document', definitions: [...originalFragments, info.operation]},
                    originalNode: original,
                    node: root,
                    schema: info.schema,
                    links: config.links!,
                    ignoreFirstLayer: true // first-level fields would be nested calls, there we want the link data
                });
            }

            // do this after replaceLinksByScalarField because it causes the schema and query to divert
            if (config.typeRenamer) {
                root = renameTypes(root, config.typeRenamer!);
            }
            return root;
        }

        const fragments = originalFragments.map(processRoot);
        const fieldNodes = info.fieldNodes.map(processRoot);
        const roots = [...fragments, ...fieldNodes];

        const selections = fieldNodes
            .map(node => node.selectionSet ? node.selectionSet.selections : [])
            .reduce((a, b) => a.concat(b), []);
        const variableNames = collectUsedVariableNames(roots);
        const vars = (info.operation.variableDefinitions || [])
            .filter(variable => variableNames.has(variable.variable.name.value));

        const operation: OperationDefinitionNode = {
            kind: 'OperationDefinition',
            operation: 'query',
            variableDefinitions: vars,
            selectionSet: {
                kind: 'SelectionSet',
                selections: selections
            }
        };

        const variables = pickIntoObject(info.variableValues, Array.from(variableNames));
        let data = {operation, fragments, variables};
        if (config.transform) {
            data = config.transform(data, {source, info});
        }

        const document: DocumentNode = {
            kind: 'Document',
            definitions: [
                ...data.fragments,
                data.operation
            ]
        };
        const queryStr = print(document);
        console.log(queryStr);
        console.log(data.variables);

        return await query(config.url, queryStr, data.variables);
    };
}

function pickIntoArray<TValue>(object: { [key: string]: TValue }, keys: string[]): TValue[] {
    return keys.map(key => object[key]);
}

function pickIntoObject<TValue>(object: { [key: string]: TValue }, keys: string[]): { [key: string]: TValue } {
    const obj: { [key: string]: TValue } = {};
    for (const key of keys) {
        obj[key] = object[key];
    }
    return obj;
}

function renameTypes(root: ASTNode, typeNameTransformer: (name: string) => string) {
    return visit(root, {
        FragmentDefinition(node: FragmentDefinitionNode) {
            return {
                ...node,
                typeCondition: {
                    ...node.typeCondition,
                    name: {
                        kind: 'Name',
                        value: typeNameTransformer(node.typeCondition.name.value)
                    }
                }
            };
        },
        InlineFragment(node: InlineFragmentNode) {
            if (node.typeCondition) {
                return {
                    ...node,
                    typeCondition: {
                        ...node.typeCondition,
                        name: {
                            kind: 'Name',
                            value: typeNameTransformer(node.typeCondition.name.value)
                        }
                    }
                };
            }
            return undefined;
        }
    });
}

function initTypeInfoForNode(root: ASTNode, targetNode: ASTNode, schema: GraphQLSchema) {
    const typeInfo = new TypeInfo(schema);
    let found = false;
    // Can't use visitWithTypeInfo here because it calls all leave() functions even on BREAK
    visit(root, {
        enter(node: ASTNode) {
            if (node == targetNode) {
                found = true;
                return BREAK;
            }
            typeInfo.enter(node);
        },
        leave(node: ASTNode) {
            if (!found) {
                typeInfo.leave(node);
            }
        }
    });
    if (!found) {
        throw new Error(`Node ${targetNode.kind} not found in document`);
    }
    return typeInfo;
}

function fetchTypenameIfFragmentsPresent(root: ASTNode) {
    // The default implementation of resolveType of an interface looks at __typename.
    // Thus, it is simplest to just request that field whenever there is a fragment
    // This will cause a collision if the user requests a different field under __typename alias
    // This also means that the result always includes __typename if fragments are used, even when not requested
    return visit(root, {
        SelectionSet(node: SelectionSetNode) {
            const requiresTypename = node.selections.some(sel => sel.kind == 'FragmentSpread' || sel.kind == 'InlineFragment');
            const requestsTypename = node.selections.some(sel => sel.kind == 'Field' && sel.name.value == '__typename');
            const isTypenameAilased = node.selections.some(sel => sel.kind == 'Field' && sel.name.value != '__typename' && !!sel.alias && sel.alias.value == '__typename');
            if (isTypenameAilased) {
                throw new Error(`Fields must not be aliased to __typename because this is a reserved field.`);
            }
            if (requiresTypename && !requestsTypename) {
                return {
                    ...node,
                    selections: [
                        ...node.selections,
                        {
                            kind: 'Field',
                            name: {
                                kind: 'Name',
                                value: '__typename'
                            }
                        }
                    ]
                };
            }
            return undefined;
        }
    });
}

function replaceLinksByScalarField(params: { originalRoot: DocumentNode, originalNode: ASTNode, node: ASTNode, schema: GraphQLSchema, links: LinkConfigMap, ignoreFirstLayer?: boolean }) {
    const typeInfo = initTypeInfoForNode(params.originalRoot, params.originalNode, params.schema);
    let layer = 0;
    return visit(params.node, visitWithTypeInfo(typeInfo, {
        Field: {
            enter(node: FieldNode) {
                if (params.ignoreFirstLayer && layer < 2) {
                    layer++;
                    return;
                }
                layer++;
                const type = typeInfo.getParentType();
                if (!type) {
                    throw new Error(`Failed to retrieve type for field ${node.name.value}`);
                }
                const linkName = type.name + '.' + typeInfo.getFieldDef().name;
                const link = params.links[linkName];
                if (link) {
                    return {
                        ...node,
                        selectionSet: undefined
                    };
                }
                return undefined;
            },

            leave() {
                layer--;
            }
        }
    }));
}

function collectUsedFragmentNames(roots: ASTNode[]): string[] {
    const fragments = new Set<string>();
    for (const root of roots) {
        visit(root, {
            FragmentSpread(node: FragmentSpreadNode) {
                fragments.add(node.name.value);
            }
        });
    }
    return Array.from(fragments);
}

function collectUsedVariableNames(roots: ASTNode[]): Set<string> {
    const variables = new Set<string>();
    for (const root of roots) {
        visit(root, {
            Variable(node: VariableNode) {
                variables.add(node.name.value);
            }
        });
    }
    return variables;
}


function collectUsedFragments(roots: ASTNode[], fragments: { [name: string]: FragmentDefinitionNode }) {
    return pickIntoArray(fragments, collectUsedFragmentNames(roots));
}
