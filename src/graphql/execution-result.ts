import { ExecutionResult, GraphQLError } from 'graphql';
import { isArray } from 'util';

export function assertSuccessfulResult(executionResult: ExecutionResult): {[key: string]: any} {
    if (isArray(executionResult.errors) && executionResult.errors.length) {
        throw new Error(executionResult.errors.map(error => error.message).join('\n'));
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
