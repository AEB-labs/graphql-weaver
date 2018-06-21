import { ExecutionResult, GraphQLError } from 'graphql';
import { modifyPropertyAtPath, replaceArrayItem } from '../utils/utils';

export class FieldErrorValue {
    constructor(public readonly originalValue: any, public readonly errors: GraphQLError[] = []) {}

    getError() {
        if (this.errors.length == 1) {
            const error = this.errors[0];
            if (!error.locations) {
                // If we don't have a location here, we should let GraphQL assign a location based on the field
                // (when throwing the error in error-resolver module)
                // this works only if path is *not* set as this property triggers a fast path in locatedError
                // we don't really need the path (it gets set by graphql, too), so just keep the message
                const plainError = new Error(this.errors[0].message);
                if ('extensions' in error) {
                    Object.defineProperty(plainError, 'etensions', {
                        value: error.extensions
                    });
                }
            }
            // error has locations, so better keep the whole thing
            // this happens when the resolver of a link value generates a validation error (with locations)
            return error;
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
