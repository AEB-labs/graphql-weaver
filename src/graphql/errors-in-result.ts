import { ExecutionResult, GraphQLError } from 'graphql';
import { modifyPropertyAtPath, replaceArrayItem } from '../utils/utils';

export class FieldErrorValue {
    constructor(public readonly originalValue: any, public readonly errors: GraphQLError[] = []) {}

    getError() {
        if (this.errors.length == 1) {
            return this.errors[0];
        }
        // don't need to be fancy, this should not happen anyway.
        return new Error(this.errors.map(err => err.message).join('\n\n'));
    }
}

/**
 * Moves errors from the 'errors' property into the correct places within the 'data' property, by wrapping them into a
 * FieldErrorValue.
 *
 * Make sure there are no existing FieldErrorValues in the data.
 *
 * Errors reported for properties not present in the return value will generate an empty skeleton of objects and arrays
 * up to the point where the error is located.
 *
 * Errors without path (validation errors) are kept in the 'errors' property.
 */
export function moveErrorsToData(result: ExecutionResult, errorMapper: (error: GraphQLError) => GraphQLError = a => a): ExecutionResult {
    if (!result.errors || !result.errors.length) {
        return result;
    }
    const globalErrors: GraphQLError[] = [];
    let data = result.data;
    for (const error of result.errors) {
        if (!error.path) {
            globalErrors.push(errorMapper(error));
            continue;
        }

        data = modifyPropertyAtPath(data, val => {
            if (val instanceof FieldErrorValue) {
                val.errors.push(errorMapper(error));
                return val;
            }
            return new FieldErrorValue(val, [ errorMapper(error) ]);
        }, error.path);
    }
    const newResult: ExecutionResult = {
        data
    };
    if (globalErrors.length) {
        newResult.errors = globalErrors;
    }
    return newResult;
}
