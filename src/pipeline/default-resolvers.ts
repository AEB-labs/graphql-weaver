import { PipelineModule } from './pipeline-module';
import { DefaultResolversTransformer } from '../graphql/default-resolvers';

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
