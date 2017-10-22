import { ExecutionResult, GraphQLError } from 'graphql';
import { isArray } from 'util';

export function assertSuccessfulResult(executionResult: ExecutionResult): {[key: string]: any} {
    if (isArray(executionResult.errors) && executionResult.errors.length) {
        if (executionResult.errors.length == 1) {
            // if we got one validation error, throw it directly so that source locations are properly used
            throw executionResult.errors[0];
        }
        // if we have multiple errors, need to bundle them in one and write their locations into the error message
        // because graphql will assign a *new* source location (the source endpoint field)
        throw new Error(executionResult.errors.map(error => errorToStr(error)).join('\n\n'));
    }

    // non-standard, but seen it in the wild
    if ('error' in executionResult && typeof (executionResult as any).error == 'string') {
        throw new Error((executionResult as any).error);
    }

    if (!executionResult.data) {
        throw new Error(`GraphQL endpoint did not report errors, but also did not provide a data result`);
    }

    if (typeof executionResult.data != 'object') {
        throw new Error(`Data result of GraphQL response is not an object`);
    }

    return executionResult.data!;
}

function errorToStr(error: GraphQLError): string {
    if (!error.locations || !error.locations.length) {
        return error.message;
    }
    return `GraphQL error at ${error.locations.map(loc => `line ${loc!.line}, column ${loc!.column}`).join(' and ')}:\n${error.message}`;
}