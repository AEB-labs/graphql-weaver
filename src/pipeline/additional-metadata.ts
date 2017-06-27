import { PipelineModule } from './pipeline-module';
import { ExtendedSchema } from '../endpoints/extended-introspection';
import { EndpointConfig } from '../config/proxy-configuration';
import { mergeFieldMetadata } from '../graphql/merge-extended-schemas';
import { objectToMap } from '../utils';

/**
 * Adds metadata specified within the endpoint configs to the extended schemas
 */
export class AdditionalMetadataModule implements PipelineModule {
    constructor(private readonly endpointConfig: EndpointConfig) {
    }

    transformExtendedSchema(schema: ExtendedSchema) {
        let meta = this.endpointConfig.fieldMetadata;
        if (!this.endpointConfig.fieldMetadata) {
            return schema;
        }
        return schema.withFieldMetadata(mergeFieldMetadata(schema.fieldMetadata, objectToMap(this.endpointConfig.fieldMetadata)));
    }
}
