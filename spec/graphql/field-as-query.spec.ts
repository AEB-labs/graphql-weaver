import {
    execute, FieldNode, GraphQLObjectType, GraphQLResolveInfo, GraphQLSchema, GraphQLString, NamedTypeNode,
    OperationDefinitionNode, parse, VariableNode
} from 'graphql';
import { getFieldAsQuery } from '../../src/graphql/field-as-query';

describe('getFieldAsQuery', () => {
    let resolveInfo: GraphQLResolveInfo | undefined;
    const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
            name: 'Query',
            fields: {
                field: {
                    type: new GraphQLObjectType({
                        name: 'Inner',
                        fields: {
                            str: {
                                type: GraphQLString,
                                args: {
                                    arg: {
                                        type: GraphQLString
                                    }
                                }
                            }
                        }
                    }),
                    resolve: (a, b, c, info) => {
                        resolveInfo = info;
                    }
                }
            }
        })
    });

    async function query(str: string, variableValues: { [name: string]: any } = {}) {
        resolveInfo = undefined;
        const query = parse(str);
        const res = await execute(schema, query, {}, {}, variableValues);
        expect(res.errors).not.toBeDefined(JSON.stringify(res.errors));
        expect(resolveInfo).toBeDefined('resolve was not called');
        return getFieldAsQuery(resolveInfo!);
    }

    it('works with simple query', async () => {
        const result = await query(`{field{str}}`);

        const operation = <OperationDefinitionNode>result.document.definitions[0];
        expect(operation.kind).toBe('OperationDefinition');

        const field = <FieldNode>operation.selectionSet.selections[0];
        expect(field.kind).toBe('Field');
        expect(field.name.value).toBe('str');
    });

    it('works with fragments', async () => {
        const result = await query(`
            fragment frag on Query {
                field{str}
            }
            
            {            
                ...frag
            }
        `);

        const operation = <OperationDefinitionNode>result.document.definitions[0];
        expect(operation.kind).toBe('OperationDefinition');

        const field = <FieldNode>operation.selectionSet.selections[0];
        expect(field.kind).toBe('Field');
        expect(field.name.value).toBe('str');
    });

    it('works with nested fragments', async () => {
        const result = await query(`
            fragment frag1 on Query {
                ...frag2
            }
        
            fragment frag2 on Query {
                field{str}
            }

            {
                ...frag1
            }
        `);

        const operation = <OperationDefinitionNode>result.document.definitions[0];
        expect(operation.kind).toBe('OperationDefinition');

        const field = <FieldNode>operation.selectionSet.selections[0];
        expect(field.kind).toBe('Field');
        expect(field.name.value).toBe('str');
    });

    it('passes through arguments and variables', async () => {
        const result = await query(`query($a: String) { field { str(arg: $a) } }`, {a: 'abc'});

        const operation = <OperationDefinitionNode>result.document.definitions[0];
        expect(operation.kind).toBe('OperationDefinition');
        expect(operation.variableDefinitions![0].variable.name.value).toBe('a');
        expect((<NamedTypeNode>operation.variableDefinitions![0].type).name.value).toEqual('String');

        const field = <FieldNode>operation.selectionSet.selections[0];
        expect(field.kind).toBe('Field');
        expect(field.name.value).toBe('str');
        expect(field.arguments![0].value.kind).toBe('Variable');
        expect((<VariableNode>field.arguments![0].value).name.value).toBe('a');
        expect(result.variableValues.a).toBe('abc');
    });
});
