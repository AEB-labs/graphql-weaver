import { WeavingConfig } from '../../../src/config/weaving-config';
import { GraphQLClient } from '../../../src/graphql-client/graphql-client';
import { ExecutionResult } from 'graphql';
import { defaultTestSchema } from '../../helpers/grapqhl-http-test/graphql-http-test-schema';
import { WeavingErrorHandlingMode } from '../../../src/config/error-handling';
import gql from 'graphql-tag';
import { makeExecutableSchema } from '@graphql-tools/schema';

const errorClient: GraphQLClient = {
    execute(query, vars, context, introspection): Promise<ExecutionResult> {
        throw new Error(introspection ? 'Throwing introspection' : 'Throwing query');
    }
};

const normalSchema = makeExecutableSchema({
    // ZInner should be alphabeticaly after Query so that joining occurs before linking (to test another error case)
    typeDefs: gql`type ZInner { field: String } type Query { inner: ZInner, inners: [ZInner] }`,
    resolvers: {
        Query: {
            inner() {
                return { field: 'hello' };
            },
            inners() {
                return [ { field: 'hello' }, { field: 'world' } ];
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
                    'ZInner.field': {
                        link: {
                            field: 'nonexisting',
                            argument: 'id',
                            batchMode: false
                        }
                    }
                }
            },
            {
                namespace: 'joinConfigError',
                typePrefix: 'joinConfigError',
                schema: normalSchema,
                fieldMetadata: {
                    'ZInner.field': {
                        link: {
                            field: 'nonexisting',
                            argument: 'id',
                            batchMode: true,
                            keyField: 'key'
                        }
                    },
                    'Query.inners': {
                        join: {
                            linkField: 'field'
                        }
                    }
                }
            },
        ],
        errorHandling: WeavingErrorHandlingMode.CONTINUE_AND_REPORT_IN_SCHEMA
    };
}
