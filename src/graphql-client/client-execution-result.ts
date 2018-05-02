import { ExecutionResult, GraphQLError, GraphQLFormattedError } from 'graphql';

/**
 * The result of executing a GraphQL operation via a GraphQLClient
 *
 * The difference to ExecutionResult is that errors do not need to be Error instances, so that the direct response
 * (sent over HTTP) can be used
 */
export interface ClientExecutionResult {
    data?: { [key: string]: any };
    extensions?: { [key: string]: any };
    errors?: GraphQLFormattedError[];
}

export function convertFormattedErrorsToErrors(result: ClientExecutionResult): ExecutionResult {
    if (!result.errors) {
        return result as ExecutionResult;
    }

    return {
        ...result,
        errors: result.errors.map(err => convertFormattedErrorToError(err))
    };
}

function convertFormattedErrorToError(error: GraphQLFormattedError): GraphQLError {
    if (error instanceof GraphQLError) {
        return error;
    }

    // can't set locations directly, only through nodes or positions, but we don't have those
    // this should not be a problem with clients that either execute the schema directly (LocalGraphQLClient) or that
    // use mapErrorLocations (which creates GraphQLError instances directly, like HttpGraphQLClient).
    // In fact, passing through locations is most likely to be wrong anyway if they are not mapped directly.
    return new GraphQLError(error.message, undefined, undefined, undefined, error.path);
}
