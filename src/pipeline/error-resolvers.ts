import { PipelineModule } from './pipeline-module';
import { GraphQLNamedFieldConfig, SchemaTransformer } from 'graphql-transformer';
import { FieldErrorValue } from '../graphql/errors-in-result';
import { defaultFieldResolver } from 'graphql';

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
        return {
            ...config,
            async resolve(source, args, context, info) {
                const value = await (config.resolve || defaultFieldResolver)(source, args, context, info);
                if (value instanceof FieldErrorValue) {
                    throw value.getError();
                }
                return value;
            }
        };
    }
}
