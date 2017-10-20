import { PipelineModule } from './pipeline-module';
import { GraphQLNamedFieldConfig, SchemaTransformer } from 'graphql-transformer';

/**
 * Replaces default (undefined) resolves with resolvers that use the alias instead of field name for lookup
 *
 * This is required because proxied responses already have the target structure with aliased fields
 */
export class DefaultResolversModule implements PipelineModule {
    getSchemaTransformer() {
        return new DefaultResolversTransformer();
    }
}

/**
 * Adds default resolves that use node aliases instead of normal field names for object property lookup
 *
 * This is needed because the aliasing is already done on the target endpoint.
 */
export class DefaultResolversTransformer implements SchemaTransformer {
    transformField(config: GraphQLNamedFieldConfig<any, any>): GraphQLNamedFieldConfig<any, any> {
        if (config.resolve) {
            return config;
        }
        return {
            ...config,
            resolve(source, args, context, info) {
                const fieldNode = info.fieldNodes[0];
                const alias = fieldNode.alias ? fieldNode.alias.value : fieldNode.name.value;
                return source[alias];
            }
        };
    }
}
