import { WeavingConfig } from '../../../src/config/weaving-config';
import { GraphQLClient } from '../../../src/graphql-client/graphql-client';
import { ExecutionResult } from 'graphql';
import { defaultTestSchema } from '../../helpers/grapqhl-http-test/graphql-http-test-schema';
import { WeavingErrorHandlingMode } from '../../../src/config/error-handling';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';

const errorClient: GraphQLClient = {
    execute(query, vars, context, introspection): Promise<ExecutionResult> {
        throw new Error(introspection ? 'Throwing introspection' : 'Throwing query');
    }
};

const normalSchema = makeExecutableSchema({
    typeDefs: gql`type Query { field: String }`,
    resolvers: {
        Query: {
            field() {
                return 'hello';
            }
        }
    }
});

export async function getConfig(): Promise<WeavingConfig> {
    return {
        endpoints: [
            {
                client: errorClient,
                identifier: 'namespaceless-erroneous'
            },
            {
                namespace: 'erroneous',
                client: errorClient
            },
            {
                namespace: 'erroneousPrefixed',
                typePrefix: 'Erroneous',
                client: errorClient
            },
            {
                namespace: 'working',
                typePrefix: 'Working',
                schema: defaultTestSchema
            },
            {
                namespace: 'linkConfigError',
                typePrefix: 'LinkConfigError',
                schema: normalSchema,
                fieldMetadata: {
                    'Query.field': {
                        link: {
                            field: 'nonexisting',
                            argument: 'id',
                            batchMode: false
                        }
                    }
                }
            },
        ],
        errorHandling: WeavingErrorHandlingMode.CONTINUE
    };
}
