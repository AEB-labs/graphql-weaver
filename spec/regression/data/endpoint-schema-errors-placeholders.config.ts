import { WeavingConfig } from '../../../src/config/weaving-config';
import { GraphQLClient } from '../../../src/graphql-client/graphql-client';
import { ExecutionResult } from 'graphql';
import { defaultTestSchema } from '../../helpers/grapqhl-http-test/graphql-http-test-schema';
import { WeavingErrorHandlingMode } from '../../../src/config/error-handling';

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
                namespace: 'erroneousPrefixed',
                typePrefix: 'Erroneous',
                client: errorClient
            },
            {
                namespace: 'working',
                typePrefix: 'Working',
                schema: defaultTestSchema
            }
        ],
        errorHandling: WeavingErrorHandlingMode.CONTINUE_AND_ADD_PLACEHOLDERS
    };
}
