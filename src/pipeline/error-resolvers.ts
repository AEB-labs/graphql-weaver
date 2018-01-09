import { PipelineModule } from './pipeline-module';
import { GraphQLNamedFieldConfig, SchemaTransformer } from 'graphql-transformer';
import { FieldErrorValue } from '../graphql/errors-in-result';
import { defaultFieldResolver } from 'graphql';
import { isPromise } from '../utils/utils';

/**
 * Throws GraphQL errors if FieldErrorValues are encountered.
 *
 * This complements moveErrorsIntoData().
 */
export class ErrorResolversModule implements PipelineModule {
    getSchemaTransformer() {
        return new ErrorResolversTransformer();
    }
}

export class ErrorResolversTransformer implements SchemaTransformer {
    transformField(config: GraphQLNamedFieldConfig<any, any>): GraphQLNamedFieldConfig<any, any> {
        const oldResolve = config.resolve || defaultFieldResolver;
        return {
            ...config,
            resolve(source,args,context,info) {
                const value = oldResolve(source,args,context,info);

                // For performance reasons, don't use async/await here. This resolver is called for each individual
                // field of each object instance. Most calls are just synchronous field value lookups. Using the state
                // machine for ever for every call would be very expensive (slows down large queries by factor of ~10).

                if (isPromise(value)) {
                    return value.then(val => {
                        if (val instanceof FieldErrorValue) {
                            throw val.getError();
                        }
                        return val;
                    });
                }

                if (value instanceof FieldErrorValue) {
                    throw value.getError();
                }
                return value;
            }
        };
    }
}
