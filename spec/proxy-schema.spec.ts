import { createProxySchema } from '../src/proxy-schema';
import { GraphQLClient } from '../src/graphql-client/graphql-client';
import { DocumentNode, execute, graphql, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { assertSuccessfulResult } from '../src/graphql/execution-result';

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

        const client: GraphQLClient = {
            async execute(document: DocumentNode, variables: { [name: string]: any }, context: any) {
                wasExecuted = true;
                capturedContext = context;
                return execute(schema, document, undefined, context, variables);
            }
        };

        const proxySchema = await createProxySchema({
            endpoints: [
                {
                    client
                }
            ]
        });

        const context = {the: 'context'};
        const result = await graphql(proxySchema, '{test}', undefined, context);
        expect(wasExecuted).toBeTruthy('Endpoint was not called');
        expect(capturedContext).toBe(context, 'Context was not passed to endpoint');
    });
});
