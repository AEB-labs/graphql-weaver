import {
    addFieldSelectionSafely, createFieldNode, createNestedArgumentWithVariableNode, createTypeNode,
    createVariableDefinitionNode
} from '../../src/graphql/language-utils';
import {
    FragmentDefinitionNode, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString, NamedTypeNode,
    ObjectValueNode, SelectionSetNode, VariableNode
} from 'graphql';

describe('language-utils', () => {
    describe('createFieldNode', () => {
        it('works without alias', () => {
            const result = createFieldNode('field');
            expect(result.kind).toBe('Field');
            expect(result.name.kind).toBe('Name');
            expect(result.name.value).toBe('field');
        });

        it('works with alias', () => {
            const result = createFieldNode('field', 'alias');
            expect(result.kind).toBe('Field');

            expect(result.name.kind).toBe('Name');
            expect(result.name.value).toBe('field');

            expect(result.alias!.kind).toBe('Name');
            expect(result.alias!.value).toBe('alias');
        });
    });

    describe('createTypeNode', () => {
        it('supports native types', () => {
            const result = createTypeNode(GraphQLString);
            expect(result.kind).toBe('NamedType');
            expect((<NamedTypeNode>result).name.value).toBe('String');
        });

        it('supports object types', () => {
            const type = new GraphQLObjectType({name: 'TypeName', fields: {}});
            const result = createTypeNode(type);
            expect(result.kind).toBe('NamedType');
            expect(result.name.value).toBe('TypeName');
        });

        it('supports non-null types', () => {
            const result = createTypeNode(new GraphQLNonNull(GraphQLString));
            expect(result.kind).toBe('NonNullType');
            const innerType = result.type;
            expect(innerType.kind).toBe('NamedType');
            expect((<NamedTypeNode>innerType).name.value).toBe('String');
        });

        it('supports list types', () => {
            const result = createTypeNode(new GraphQLList(GraphQLString));
            expect(result.kind).toBe('ListType');
            const innerType = result.type;
            expect(innerType.kind).toBe('NamedType');
            expect((<NamedTypeNode>innerType).name.value).toBe('String');
        });
    });

    describe('createVariableDefinitionNode', () => {
        it('supports simple types', () => {
            const result = createVariableDefinitionNode('varName', GraphQLString);
            expect(result.kind).toBe('VariableDefinition');
            expect((<NamedTypeNode>result.type).name.value).toBe('String');
            expect(result.variable.name.value).toBe('varName');
        });
    });

    describe('createNestedArgumentWithVariableNode', () => {
        it('works with simple argument', () => {
            const result = createNestedArgumentWithVariableNode('arg', 'varName');
            expect(result.kind).toBe('Argument');
            expect(result.name.value).toBe('arg');
            expect(result.value.kind).toBe('Variable');
            expect((<VariableNode>result.value).name.value).toBe('varName');
        });

        it('works with singly nested argument', () => {
            const result = createNestedArgumentWithVariableNode('arg.field', 'varName');
            expect(result.kind).toBe('Argument');
            expect(result.name.value).toBe('arg');
            expect(result.value.kind).toBe('ObjectValue');
            const obj = <ObjectValueNode>result.value;
            expect(obj.fields.length).toBe(1);
            expect(obj.fields[0].name.value).toBe('field');
            expect(obj.fields[0].value.kind).toBe('Variable');
            expect((<VariableNode>obj.fields[0].value).name.value).toBe('varName');
        });

        it('works with doubly nested argument', () => {
            const result = createNestedArgumentWithVariableNode('arg.field1.field2', 'varName');
            expect(result.kind).toBe('Argument');
            expect(result.name.value).toBe('arg');
            expect(result.value.kind).toBe('ObjectValue');

            const obj1 = <ObjectValueNode>result.value;
            expect(obj1.fields.length).toBe(1);
            expect(obj1.fields[0].name.value).toBe('field1');
            expect(obj1.fields[0].value.kind).toBe('ObjectValue');

            const obj2 = <ObjectValueNode>obj1.fields[0].value;
            expect(obj2.fields.length).toBe(1);
            expect(obj2.fields[0].name.value).toBe('field2');

            expect(obj2.fields[0].value.kind).toBe('Variable');
            expect((<VariableNode>obj2.fields[0].value).name.value).toBe('varName');
        });
    });

    describe('addFieldSelectionSafely', () => {
        it('does nothing when field already exists', () => {
            const inputSelectionSet: SelectionSetNode = {
                kind: 'SelectionSet',
                selections: [
                    createFieldNode('fieldName')
                ]
            };
            const { alias, selectionSet } = addFieldSelectionSafely(inputSelectionSet, 'fieldName');
            expect(alias).toBe('fieldName');
            expect(selectionSet).toEqual(inputSelectionSet);
        });

        it('does nothing when field already exists, but is aliased', () => {
            const inputSelectionSet: SelectionSetNode = {
                kind: 'SelectionSet',
                selections: [
                    createFieldNode('otherField', 'fieldName'),
                    createFieldNode('fieldName', 'aliasedName')
                ]
            };
            const { alias, selectionSet } = addFieldSelectionSafely(inputSelectionSet, 'fieldName');
            expect(alias).toBe('aliasedName');
            expect(selectionSet).toEqual(inputSelectionSet);
        });

        it('adds the field when it does not already exist', () => {
            const inputSelectionSet: SelectionSetNode = {
                kind: 'SelectionSet',
                selections: [
                    createFieldNode('otherField')
                ]
            };
            const { alias, selectionSet } = addFieldSelectionSafely(inputSelectionSet, 'fieldName');
            expect(alias).toBe('fieldName');
            expect(selectionSet).toEqual({
                ...inputSelectionSet,
                selections: [
                    ...inputSelectionSet.selections,
                    createFieldNode('fieldName')
                ]
            });
        });

        it('renames the field when it collides with an existing field', () => {
            const inputSelectionSet: SelectionSetNode = {
                kind: 'SelectionSet',
                selections: [
                    createFieldNode('otherField', 'fieldName')
                ]
            };
            const { alias, selectionSet } = addFieldSelectionSafely(inputSelectionSet, 'fieldName');
            expect(alias).toBe('fieldName0');
            expect(selectionSet).toEqual({
                ...inputSelectionSet,
                selections: [
                    ...inputSelectionSet.selections,
                    createFieldNode('fieldName', 'fieldName0')
                ]
            });
        });

        it('renames the field when it collides with an existing field twice', () => {
            const inputSelectionSet: SelectionSetNode = {
                kind: 'SelectionSet',
                selections: [
                    createFieldNode('otherField1', 'fieldName'),
                    createFieldNode('otherField2', 'fieldName0')
                ]
            };
            const { alias, selectionSet } = addFieldSelectionSafely(inputSelectionSet, 'fieldName');
            expect(alias).toBe('fieldName1');
            expect(selectionSet).toEqual({
                ...inputSelectionSet,
                selections: [
                    ...inputSelectionSet.selections,
                    createFieldNode('fieldName', 'fieldName1')
                ]
            });
        });

        it('renames the field when it collides with a field of an inline fragment', () => {
            const inputSelectionSet: SelectionSetNode = {
                kind: 'SelectionSet',
                selections: [
                    createFieldNode('otherField'),
                    {
                        kind: 'InlineFragment',
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [
                                createFieldNode('otherField', 'fieldName')
                            ]
                        }
                    }
                ]
            };
            const { alias, selectionSet } = addFieldSelectionSafely(inputSelectionSet, 'fieldName');
            expect(alias).toBe('fieldName0');
            expect(selectionSet).toEqual({
                ...inputSelectionSet,
                selections: [
                    ...inputSelectionSet.selections,
                    createFieldNode('fieldName', 'fieldName0')
                ]
            });
        });

        it('renames the field when it collides with the same field in an inline fragment', () => {
            // this is because we cannot be sure the type condition holds, so the field may be missing

            const inputSelectionSet: SelectionSetNode = {
                kind: 'SelectionSet',
                selections: [
                    createFieldNode('otherField'),
                    {
                        kind: 'InlineFragment',
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [
                                createFieldNode('fieldName')
                            ]
                        }
                    }
                ]
            };
            const { alias, selectionSet } = addFieldSelectionSafely(inputSelectionSet, 'fieldName');
            expect(alias).toBe('fieldName0');
            expect(selectionSet).toEqual({
                ...inputSelectionSet,
                selections: [
                    ...inputSelectionSet.selections,
                    createFieldNode('fieldName', 'fieldName0')
                ]
            });
        });

        it('renames the field when it collides with a field of a fragment spread', () => {
            const inputSelectionSet: SelectionSetNode = {
                kind: 'SelectionSet',
                selections: [
                    createFieldNode('otherField'),
                    {
                        kind: 'FragmentSpread',
                        name: {
                            kind: 'Name',
                            value: 'frag'
                        }
                    }
                ]
            };
            const fragments: {[name: string]: FragmentDefinitionNode} = {
                frag: {
                    kind: 'FragmentDefinition',
                    name: {
                        kind: 'Name',
                        value: 'frag'
                    },
                    typeCondition: createTypeNode(GraphQLString),
                    selectionSet: {
                        kind: 'SelectionSet',
                        selections: [
                            createFieldNode('otherField', 'fieldName')
                        ]
                    }
                }
            };
            const { alias, selectionSet } = addFieldSelectionSafely(inputSelectionSet, 'fieldName', fragments);
            expect(alias).toBe('fieldName0');
            expect(selectionSet).toEqual({
                ...inputSelectionSet,
                selections: [
                    ...inputSelectionSet.selections,
                    createFieldNode('fieldName', 'fieldName0')
                ]
            });
        });
    });
});
