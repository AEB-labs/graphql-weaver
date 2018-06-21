import { ExecutionResult, GraphQLError, GraphQLFormattedError } from 'graphql';

/**
 * The result of executing a GraphQL operation via a GraphQLClient
 *
 * The difference to ExecutionResult is that errors do not need to be Error instances, so that the direct response
 * (sent over HTTP) can be used
 *
 * This type is slightly inaccurate: graphql-weaver already employs graphqljs@0.14 semantics of error extensions, thus
 * there should only be an optional `extensions` property in a formatted error instead of arbitrary properties.
 */
export interface ClientExecutionResult {
    data?: { [key: string]: any };
    errors?: ReadonlyArray<GraphQLFormattedError>;
}

/**
 * Converts a GraphQL response (a ClientExecutionResult) back into the ExecutionResult format which has actual
 * GraphQLError instances.
 */
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
    return new GraphQLError(error.message, undefined, undefined, undefined, error.path, undefined, error.extensions);
}
