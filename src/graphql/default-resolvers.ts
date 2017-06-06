import { GraphQLNamedFieldConfig, SchemaTransformer } from './schema-transformer';

/**
 * Adds default resolves that use node aliases instead of normal field names for object property lookup
 *
 * This is needed because the aliasing is already done on the target endpoint.
 */
export class DefaultResolversTransformer implements SchemaTransformer {
    transformField(config: GraphQLNamedFieldConfig<any, any>) {
        if (!config.resolve) {
            config.resolve = ((source, args, context, info) => {
                const fieldNode = info.fieldNodes[0];
                const alias = fieldNode.alias ? fieldNode.alias.value : fieldNode.name.value;
                return source[alias];
            })
        }
    }
}