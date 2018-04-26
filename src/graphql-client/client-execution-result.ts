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

    // can't easily set the locations through the constructor
    const res = new GraphQLError(error.message, undefined, undefined, undefined, error.path);
    res.locations = error.locations;
    return res;
}
