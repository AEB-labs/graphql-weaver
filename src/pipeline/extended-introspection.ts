import { PipelineModule } from './pipeline-module';
import { GraphQLFieldConfigMap } from 'graphql';
import { EXTENDED_INTROSPECTION_FIELD, getExtendedIntrospectionType } from '../extended-schema/extended-introspection';
import { FieldsTransformationContext, transformSchema } from '../graphql/schema-transformer';
import { ExtendedSchema } from '../extended-schema/extended-schema';

/**
 * Adds the extended introspection field with the current extended schema information.
 *
 * If the extended introspection field already exists, it is overridden. Use this field at the very end of the pipeline
 * so that the correct schema is used.
 */
export class ExtendedIntrospectionModule implements PipelineModule {
    // Do we need a query transformer here? I think technically yes, but should not matter because this field would never be proxy-called

    transformExtendedSchema(schema: ExtendedSchema): ExtendedSchema {
        return schema.withSchema(transformSchema(schema.schema, {
            transformFields(config: GraphQLFieldConfigMap<any, any>, {oldOuterType}: FieldsTransformationContext): GraphQLFieldConfigMap<any, any> {
                if (oldOuterType != schema.schema.getQueryType()) {
                    return config;
                }

                return {
                    ...config,
                    [EXTENDED_INTROSPECTION_FIELD]: {
                        type: getExtendedIntrospectionType(),
                        resolve: () => schema.metadata
                    }
                };
            }
        }));
    }
}
