import {
    DocumentNode, FieldNode, GraphQLObjectType, GraphQLSchema, GraphQLString, OperationDefinitionNode, parse
} from 'graphql';
import { initTypeInfoForNode } from '../../src/graphql/type-info-initializer';

describe('initTypeInfoForNode', () => {
    it('initializes correct types', () => {
        const innerType = new GraphQLObjectType({
            name: 'Inner',
            fields: {
                str: {
                    type: GraphQLString
                }
            }
        });

        const schema = new GraphQLSchema({
            query: new GraphQLObjectType({
                name: 'Query',
                fields: {
                    field: {
                        type: innerType
                    }
                }
            })
        });

        const query = <DocumentNode>parse(`{field{str}}`);
        const outerField = <FieldNode>(<OperationDefinitionNode>query.definitions[0]).selectionSet.selections[0];
        const innerField = outerField.selectionSet!.selections[0];
        const typeInfo = initTypeInfoForNode(query, innerField, schema);
        expect(typeInfo.getParentType()).toBe(innerType);
    });
});