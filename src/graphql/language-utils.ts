import {
    ArgumentNode,
    ASTNode,
    FieldNode,
    FragmentDefinitionNode,
    GraphQLList,
    GraphQLNamedType,
    GraphQLNonNull,
    GraphQLType,
    ListTypeNode,
    NamedTypeNode,
    NonNullTypeNode,
    SelectionNode,
    SelectionSetNode,
    TypeNode,
    ValueNode,
    VariableDefinitionNode,
    visit
} from "graphql";
import {compact, flatMap} from "../utils/utils";

/**
 * Creates a field node with a name and an optional alias
 * @param name the name
 * @param alias the alias, or undefined to not specify an alias
 * @param selections an array of selection nodes, or undefined to not specify a SelectionSet node
 * @returns the field node
 */
export function createFieldNode(name: string, alias?: string, selections?: SelectionNode[]): FieldNode {
    return {
        kind: 'Field',
        name: {
            kind: 'Name',
            value: name
        },
        ...(alias ? {
            alias: {
                kind: 'Name',
                value: alias
            }
        } : {}),
        ...(selections ? {
            selectionSet: {
                kind: 'SelectionSet',
                selections
            }
        } : {})
    };
}

/**
 * Builds a SelectionSetNode for a chain of nested field selections
 *
 * The input (['a', 'b'], selSet) yields the selection set "{ a { b { selSet } } }"
 * @param fieldNames
 * @param innermostSelectionSet
 * @returns {SelectionSetNode}
 */
export function createSelectionChain(fieldNames: string[], innermostSelectionSet: SelectionSetNode): SelectionSetNode {
    return cloneSelectionChain(fieldNames.map(name => createFieldNode(name)), innermostSelectionSet);
}

/**
 * Wraps a selection set in a linear chain of selections according to an array of field nodes
 *
 * The input ("node1", "alias: node2", "node3(arg: true)"], selSet) yields the selection set
 * "{ node1 { alias: node2 { node3(arg:true) { selSet } } } }"
 *
 * @param fieldNodes
 * @param innermostSelectionSet
 * @returns {SelectionSetNode}
 */
export function cloneSelectionChain(fieldNodes: FieldNode[], innermostSelectionSet?: SelectionSetNode): SelectionSetNode {
    if (!fieldNodes.length && !innermostSelectionSet) {
        throw new Error(`Either provide innermostSelectionSet or a non-empty fieldNodes array`);
    }

    let currentSelectionSet: SelectionSetNode = innermostSelectionSet!;
    for (const fieldNode of Array.from(fieldNodes).reverse()) {
        currentSelectionSet = {
            kind: 'SelectionSet',
            selections: [
                {
                    ...fieldNode,
                    selectionSet: currentSelectionSet
                }
            ]
        };
    }
    return currentSelectionSet;
}

/**
 * Creates a GraphQL syntax node for a type reference, given the type instance of the schema
 */
export function createTypeNode(type: GraphQLNamedType): NamedTypeNode;
export function createTypeNode(type: GraphQLNonNull<any>): NonNullTypeNode;
export function createTypeNode(type: GraphQLList<any>): ListTypeNode;
export function createTypeNode(type: GraphQLType): TypeNode;
export function createTypeNode(type: GraphQLType): TypeNode {
    if (type instanceof GraphQLList) {
        return {
            kind: 'ListType',
            type: createTypeNode(type.ofType)
        };
    }
    if (type instanceof GraphQLNonNull) {
        return {
            kind: 'NonNullType',
            type: <NamedTypeNode | ListTypeNode>createTypeNode(type.ofType)
        };
    }
    return {
        kind: 'NamedType',
        name: {
            kind: 'Name',
            value: type.name
        }
    };
}

/**
 * Creates a GraphQL syntax node that defines a variable of a given name and type
 */
export function createVariableDefinitionNode(varName: string, type: GraphQLType): VariableDefinitionNode {
    return {
        kind: 'VariableDefinition',
        variable: {
            kind: 'Variable',
            name: {
                kind: 'Name',
                value: varName
            }
        },
        type: createTypeNode(type)
    };
}

/**
 * Creates a GraphQL syntax node for an actual argument with a variable as value
 *
 * argumentPath is split into dot-separated parts. The first part is the argument name, and if there are more parts,
 * they describe a sequence of input field names. For example, "arg.field1.field2" will generate a node like this:
 *
 *     arg: { field1: { field2: $variableName } }
 *
 * @param argumentPath a dot-separated segment string
 * @param variableName
 */
export function createNestedArgumentWithVariableNode(argumentPath: string, variableName: string): ArgumentNode {
    const parts = argumentPath.split('.');
    const argName = parts.shift();
    if (!argName) {
        throw new Error('Argument must not be empty');
    }

    let value: ValueNode = {
        kind: 'Variable',
        name: {
            kind: 'Name',
            value: variableName
        }
    };

    for (const part of parts.reverse()) {
        value = {
            kind: 'ObjectValue',
            fields: [
                {
                    kind: 'ObjectField',
                    value,
                    name: {
                        kind: 'Name',
                        value: part
                    }
                }
            ]
        };
    }

    return {
        kind: 'Argument',
        name: {
            kind: 'Name',
            value: argName
        },
        value
    };
}

/**
 * Adds a field to a selection set. If it already exists, does nothing and returns the name or alias of that field.
 * If there is a selection of a different field, chooses a different alias for the field and returns that alias.
 * @param selectionSet
 * @param field the name of the field to fetch
 * @param fragments an array of fragment definitions for lookup of fragment spreads (needed for uniqueness check)
 * @return an object,
 *     selectionSet: the modified selection set
 *     alias: the name of the field in the object that will be returned (alias if aliased, otherwise field name)
 */
export function addFieldSelectionSafely(selectionSet: SelectionSetNode, field: string, fragments: { [fragmentName: string]: FragmentDefinitionNode } = {}): { alias: string, selectionSet: SelectionSetNode } {
    // Do not consider fragments here because we do not know if the type of them always matches the actual type
    const existing = selectionSet.selections.filter(sel => sel.kind == 'Field' && sel.name.value == field);
    if (existing.length) {
        const sel = <FieldNode>existing[0];
        return {
            selectionSet,
            alias: sel.alias ? sel.alias.value : sel.name.value
        };
    }

    // Here, we consider all fragments to be on the safe side
    let alias = field;
    if (aliasExistsInSelection(selectionSet, alias, fragments)) {
        let number = 0;
        do {
            alias = (field + '') + number; // convert field to string, better safe than sorry
            number++;
        } while (aliasExistsInSelection(selectionSet, alias, fragments));
    }

    return {
        selectionSet: {
            ...selectionSet,
            selections: [
                ...selectionSet.selections,
                {
                    kind: 'Field',
                    name: {
                        kind: 'Name',
                        value: field
                    },

                    // simple conditional operator would set alias to undefined which is something different
                    ...(alias == field ? {} : {
                        alias: {
                            kind: 'Name',
                            value: alias
                        }
                    })
                }
            ]
        },
        alias
    };
}

/**
 * Determines whether an unaliased field with the given name or an aliased field with the given name as alias exists.
 * Inline fragments and fragment spread operators are crawled recursively. The type of fragments is not considered.
 *
 * @param selectionSet the selection set
 * @param alias the name of the field or alias to check
 * @param fragments an array of fragment definitions for lookup of fragment spreads
 */
export function aliasExistsInSelection(selectionSet: SelectionSetNode, alias: string, fragments: { [fragmentName: string]: FragmentDefinitionNode } = {}) {
    return findNodesByAliasInSelections(selectionSet.selections, alias, fragments).length > 0;
}

/**
 * Finds all the field nodes that are selected by a given selection set, by spreading all referenced fragments
 *
 * @param selections the selection set
 * @param fragments an array of fragment definitions for lookup of fragment spreads
 * @return the field nodes
 */
export function expandSelections(selections: SelectionNode[], fragments: { [fragmentName: string]: FragmentDefinitionNode } = {}): FieldNode[] {
    function findFragment(name: string): FragmentDefinitionNode {
        if (!(name in fragments)) {
            throw new Error(`Fragment ${name} is referenced but not defined`);
        }
        return fragments[name];
    }

    function expandSelection(node: SelectionNode): FieldNode[] {
        switch (node.kind) {
            case 'Field':
                return [node];
            case 'FragmentSpread':
                const fragment = findFragment(node.name.value);
                return expandSelections(fragment.selectionSet.selections, fragments);
            case 'InlineFragment':
                return expandSelections(node.selectionSet.selections, fragments);
            default:
                throw new Error(`Unexpected node kind: ${(<any>node).kind}`);
        }
    }

    return flatMap(selections, expandSelection);
}

/*
 * Finds all field node with a given alias (or name if no alias is specified) within a selection set.
 * Inline fragments and fragment spread operators are crawled recursively. The type of fragments is not considered.
 * Multiple matching nodes are collected recusivily, according to GraphQL's field node merging logic
 */
export function findNodesByAliasInSelections(selections: SelectionNode[], alias: string, fragments: { [fragmentName: string]: FragmentDefinitionNode } = {}): FieldNode[] {
    return expandSelections(selections, fragments).filter(node => getAliasOrName(node) == alias);
}


export function addVariableDefinitionSafely(variableDefinitions: VariableDefinitionNode[], name: string, type: GraphQLType): { name: string, variableDefinitions: VariableDefinitionNode[] } {
    const names = new Set(variableDefinitions.map(def => def.variable.name.value));
    let varName = name;
    if (names.has(name)) {
        let number = 0;
        do {
            varName = name + number;
            number++;
        } while (names.has(varName));
    }

    return {
        variableDefinitions: [
            ...variableDefinitions,
            createVariableDefinitionNode(varName, type)
        ],
        name: varName
    };
}

/**
 * Renames all named types starting at a node
 * @param root the node where to start
 * @param typeNameTransformer a function that gets the old name and returns the new name
 * @returns {any}
 */
export function renameTypes<T extends ASTNode>(root: T, typeNameTransformer: (name: string) => string): T {
    return visit(root, {
        NamedType(node: NamedTypeNode) {
            return {
                ...node,
                name: {
                    kind: 'Name',
                    value: typeNameTransformer(node.name.value)
                }
            };
        }
    });
}

export function collectFieldNodesInPath(selectionSet: SelectionSetNode, aliases: string[], fragments: { [fragmentName: string]: FragmentDefinitionNode } = {}): FieldNode[] {
    if (!aliases.length) {
        throw new Error(`Aliases must not be empty`);
    }

    let currentSelectionSets: SelectionSetNode[] = [selectionSet];
    const fieldNodesInPath: FieldNode[] = [];
    for (const alias of aliases) {
        if (!currentSelectionSets.length) {
            throw new Error(`Expected field ${fieldNodesInPath.length ? fieldNodesInPath[fieldNodesInPath.length - 1].name.value : ''} to have sub-selection but it does not`);
        }
        const matchingFieldNodes = flatMap(currentSelectionSets, selSet => findNodesByAliasInSelections(selSet.selections, alias, fragments));
        if (!matchingFieldNodes.length) {
            throw new Error(`Field ${alias} expected but not found`);
        }
        currentSelectionSets = compact(matchingFieldNodes.map(node => node.selectionSet));
        // those matching nodes all need to be compatible - except their selection sets (which will be merged)
        // As the consumer probably does not care about the selection set (this function here is there to process them, after all), this is probably ok
        fieldNodesInPath.push(matchingFieldNodes[0]);
    }
    return fieldNodesInPath;
}

/**
 * Gets the alias of a field node, or the field name if it does not have an alias
 * @param fieldNode
 * @returns {string}
 */
export function getAliasOrName(fieldNode: FieldNode) {
    if (fieldNode.alias) {
        return fieldNode.alias.value;
    }
    return fieldNode.name.value;
}
