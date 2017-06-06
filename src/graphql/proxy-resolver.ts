import {
    ASTNode, BREAK, DocumentNode, FieldNode, FragmentDefinitionNode, FragmentSpreadNode, GraphQLResolveInfo,
    GraphQLSchema, InlineFragmentNode, OperationDefinitionNode, print, SelectionSetNode, TypeInfo, VariableNode, visit,
    visitWithTypeInfo
} from 'graphql';
import { OperationTypeNode } from '@types/graphql/language';
import { LinkConfigMap } from '../config/proxy-configuration';

interface ResolverConfig {
    query: (document: DocumentNode, variables?: {[name: string]: any}) => Promise<any>
    operation: OperationTypeNode;
    typeRenamer?: (name: string) => string;

    /**
     * An object that maps type-field names (in the merged schema, like logistics_Delivery.country) to LinkConfigs
     */
    links?: LinkConfigMap

    transform?: (nodes: TransformData) => TransformData
}

type TransformData = { operation: OperationDefinitionNode, fragments: FragmentDefinitionNode[], variables: { [ variableName: string]: any } };

export async function resolveAsProxy(info: GraphQLResolveInfo, config: ResolverConfig) {
    function processRoot<T extends ASTNode>(root: T): T {
        const original = root;
        root = fetchTypenameIfFragmentsPresent(root);

        if (config.links) {
            root = replaceLinksByScalarField({
                originalRoot: {
                    kind: 'Document',
                    definitions: [
                        // Provide all fragments here because if one of info.fieldNodes is a field node of a fragment,
                        // that fragment is not necessarily used anywhere via the spread operator within any of the roots
                        ...Object.values(info.fragments),
                        info.operation
                    ]
                },
                originalNode: original,
                node: root,
                schema: info.schema,
                links: config.links!,
                ignoreFirstLayer: root.kind != 'FragmentDefinition' // first-level fields would be nested calls, there we want the link data
            });
        }

        // do this after replaceLinksByScalarField because it causes the schema and query to divert
        if (config.typeRenamer) {
            root = renameTypes(root, config.typeRenamer!);
        }
        return root;
    }

    // order is important because info.fieldNodes may refer to a fragment of a different endpoint which will be cut
    // off by processRoot. For the same reason, we need to give collectUsedFragments the transformer.
    const fieldNodes = info.fieldNodes.map(processRoot);
    const fragments = collectUsedFragments({
        roots: fieldNodes,
        fragmentMap: info.fragments,
        fragmentTransformer: processRoot
    });
    const roots = [...fragments, ...fieldNodes];

    const selections = fieldNodes
        .map(node => node.selectionSet ? node.selectionSet.selections : [])
        .reduce((a, b) => a.concat(b), []);
    const variableNames = collectUsedVariableNames(roots);
    const vars = (info.operation.variableDefinitions || [])
        .filter(variable => variableNames.has(variable.variable.name.value));

    const operation: OperationDefinitionNode = {
        kind: 'OperationDefinition',
        operation: info.operation.operation,
        variableDefinitions: vars,
        selectionSet: {
            kind: 'SelectionSet',
            selections: selections
        }
    };

    const variables = pickIntoObject(info.variableValues, Array.from(variableNames));
    let data = {operation, fragments, variables};
    if (config.transform) {
        data = config.transform(data);
    }

    const document: DocumentNode = {
        kind: 'Document',
        definitions: [
            ...data.fragments,
            data.operation
        ]
    };
    return await config.query(document, data.variables);
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
        throw new Error(`${targetNode.kind} node not found in document`);
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

function collectDirectlyUsedFragmentNames(roots: ASTNode[]): string[] {
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


function collectUsedFragments(params: { roots: ASTNode[], fragmentMap: { [name: string]: FragmentDefinitionNode }, fragmentTransformer?: (node: FragmentDefinitionNode) => FragmentDefinitionNode }) {
    let fragments: FragmentDefinitionNode[] = [];
    let originalFragments = new Set<FragmentDefinitionNode>();
    let hasChanged = false;
    do {
        const newFragments = pickIntoArray(params.fragmentMap, collectDirectlyUsedFragmentNames(params.roots.concat(fragments)));
        hasChanged = false;
        for (const fragment of newFragments) {
            if (!originalFragments.has(fragment)) {
                originalFragments.add(fragment);
                fragments.push(params.fragmentTransformer ? params.fragmentTransformer(fragment) : fragment);
                hasChanged = true;
            }
        }
    } while (hasChanged);
    return fragments;
}
