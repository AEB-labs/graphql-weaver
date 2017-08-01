import { ExecutionResult } from 'graphql';
import TraceError = require('trace-error');

export function assertSuccessfulResult(executionResult: ExecutionResult): {[key: string]: any} {
    if (executionResult.errors && executionResult.errors.length) {
        // TODO properly handle multiple errors
        const errObj = executionResult.errors[0];
        if (errObj) {
            throw new TraceError(`GraphQL error: ${errObj.message}`, errObj);
        }
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
