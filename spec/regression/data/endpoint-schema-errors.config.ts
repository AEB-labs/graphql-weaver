import { WeavingConfig } from '../../../src/config/weaving-config';
import { GraphQLClient } from '../../../src/graphql-client/graphql-client';
import { ExecutionResult } from 'graphql';
import { defaultTestSchema } from '../../helpers/grapqhl-http-test/graphql-http-test-schema';

const errorClient: GraphQLClient = {
    execute(query, vars, context, introspection): Promise<ExecutionResult> {
        throw new Error(introspection ? 'Throwing introspection' : 'Throwing query');
    }
};

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
                namespace: 'erroneous',
                typePrefix: 'Erroneous',
                client: errorClient
            },
            {
                namespace: 'working',
                typePrefix: 'Working',
                schema: defaultTestSchema
            }
        ],
        continueOnEndpointErrors: true
    };
}

