import { ASTNode, DefinitionNode, DocumentNode, FieldNode, FragmentDefinitionNode, FragmentSpreadNode, OperationDefinitionNode, OperationTypeNode, ResponsePath, SelectionNode, SelectionSetNode, VariableDefinitionNode, VariableNode, visit } from 'graphql';
import { arrayToObject, divideArrayByPredicate, flatMap } from '../utils/utils';
import { Query } from './common';

export type QueryParts = {
    fragments: ReadonlyArray<FragmentDefinitionNode>,
    selectionSet: SelectionSetNode,
    variableDefinitions: VariableDefinitionNode[],
    variableValues: { [name: string]: any }
    operation: OperationTypeNode;
    operationName: string | undefined;
};

export interface SlimGraphQLResolveInfo {
    fieldNodes: ReadonlyArray<FieldNode>
    fragments: { [fragmentName: string]: FragmentDefinitionNode };
    operation: OperationDefinitionNode;
    variableValues: { [variableName: string]: any };
    path: ResponsePath
}

/**
 * Prepares all the parts necessary to construct a GraphQL query document like produced by getFieldAsQuery
 */
export function getFieldAsQueryParts(info: SlimGraphQLResolveInfo): QueryParts {
    const fragments = collectUsedFragments(info.fieldNodes, info.fragments);
    const selections = collectSelections(info.fieldNodes);
    const selectionSet: SelectionSetNode = {
        kind: 'SelectionSet',
        selections
    };
    const variableNames = collectUsedVariableNames([...fragments, ...info.fieldNodes]);
    const variableDefinitions = (info.operation.variableDefinitions || [])
        .filter(variable => variableNames.has(variable.variable.name.value));
    const variableValues = pickIntoObject(info.variableValues, Array.from(variableNames));
    const operation = info.operation.operation;
    const operationName = info.operation.name ? info.operation.name.value : undefined;

    return { fragments, variableDefinitions, variableValues, selectionSet, operation, operationName };
}

/**
 * Constructs a GraphQL query document from a field as seen by a resolver
 *
 * This is the basic component of a proxy - a resolver calls this method and then sends the query to the upstream server
 */
export function getFieldAsQuery(info: SlimGraphQLResolveInfo): Query {
    return getQueryFromParts(getFieldAsQueryParts(info));
}

export function getQueryFromParts(parts: QueryParts) {
    const { fragments, variableDefinitions, variableValues, selectionSet, operation } = parts;

    const operationNode: OperationDefinitionNode = {
        kind: 'OperationDefinition',
        operation,
        name: parts.operationName ? { kind: 'Name', value: parts.operationName } : undefined,
        variableDefinitions,
        selectionSet
    };

    const document: DocumentNode = {
        kind: 'Document',
        definitions: [
            operationNode,
            ...fragments
        ]
    };

    return {
        document,
        variableValues
    };
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
            VariableDefinition() {
                return false; // don't regard var definitions as usages
            },
            Variable(node: VariableNode) {
                variables.add(node.name.value);
            }
        });
    }
    return variables;
}

export function collectUsedFragments(roots: ReadonlyArray<ASTNode>, fragmentMap: { [name: string]: FragmentDefinitionNode }) {
    let fragments: FragmentDefinitionNode[] = [];
    let originalFragments = new Set<FragmentDefinitionNode>();
    let hasChanged = false;
    do {
        const newFragments = pickIntoArray(fragmentMap, collectDirectlyUsedFragmentNames(roots.concat(fragments))); // seemds odd to be cummulative here
        hasChanged = false;
        for (const fragment of newFragments) {
            if (!originalFragments.has(fragment)) {
                originalFragments.add(fragment);
                fragments.push(fragment);
                hasChanged = true;
            }
        }
    } while (hasChanged);
    return fragments;
}

function buildFragmentMap(definitions: FragmentDefinitionNode[]): { [name: string]: FragmentDefinitionNode } {
    return arrayToObject(definitions, def => def.name.value);
}

/**
 * Gets a new, semantically equal document where unused fragments are removed
 */
export function dropUnusedFragments(document: DocumentNode): DocumentNode {
    const [fragments, nonFragmentDefs] = divideArrayByPredicate(document.definitions, def => def.kind == 'FragmentDefinition');
    const fragmentMap = buildFragmentMap(fragments as FragmentDefinitionNode[]);
    const usedFragments = collectUsedFragments(nonFragmentDefs, fragmentMap);

    return {
        ...document,
        definitions: [
            ...nonFragmentDefs,
            ...usedFragments
        ]
    };
}

/**
 * Gets a new, semantically equal query where unused variables are removed
 */
export function dropUnusedVariables(query: Query): Query {
    const [operations, nonOperationDefs] =
        divideArrayByPredicate(query.document.definitions, def => def.kind == 'OperationDefinition') as [OperationDefinitionNode[], DefinitionNode[]];
    const usedVarNames = collectUsedVariableNames([query.document]);
    if (operations.length == 0) {
        return query;
    }
    if (operations.length > 1) {
        throw new Error(`Multiple operations not supported in dropUnusedVariables`);
    }
    const operation = operations[0];
    const newOperation: OperationDefinitionNode = {
        ...operation,
        variableDefinitions: operation.variableDefinitions ? operation.variableDefinitions.filter(variable => usedVarNames.has(variable.variable.name.value)) : undefined
    };

    const variableValues = pickIntoObject(query.variableValues, Array.from(usedVarNames));

    return {
        ...query,
        variableValues,
        document: {
            ...query.document,
            definitions: [
                ...nonOperationDefs,
                newOperation
            ]
        }
    };
}

/**
 * Collects the selections of all given field nodes
 * @param fieldNodes the selections
 * @returns {any}
 */
function collectSelections(fieldNodes: ReadonlyArray<FieldNode>): SelectionNode[] {
    return flatMap(fieldNodes, node => node.selectionSet ? node.selectionSet.selections : []);
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
