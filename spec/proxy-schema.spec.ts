import { createProxySchema } from '../src/proxy-schema';
import { GraphQLEndpoint } from '../src/endpoints/graphql-endpoint';
import { DocumentNode, execute, graphql, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { assertSuccessfulResponse } from '../src/endpoints/client';

describe('proxy-schema', () => {
    it('supports custom endpoints and passes through context', async () => {
        const schema = new GraphQLSchema({
            query: new GraphQLObjectType({
                name: 'Query',
                fields: {
                    test: {type: GraphQLString}
                }
            })
        });

        let wasExecuted = false;
        let capturedContext: any = undefined;

        const endpoint: GraphQLEndpoint = {
            async query(document: DocumentNode, variables: { [name: string]: any }, context: any) {
                wasExecuted = true;
                capturedContext = context;
                const result = await execute(schema, document, undefined, context, variables);
                assertSuccessfulResponse(result);
                return result.data;
            }
        };

        const proxySchema = await createProxySchema({
            endpoints: [
                {
                    endpoint
                }
            ]
        });

        const context = {the: 'context'};
        const result = await graphql(proxySchema, '{test}', undefined, context);
        expect(wasExecuted).toBeTruthy('Endpoint was not called');
        expect(capturedContext).toBe(context, 'Context was not passed to endpoint');
    });
});
