import { ProxyConfig } from './config/proxy-configuration';
import { GraphQLSchema } from 'graphql';
import { DefaultEndpointFactory } from './endpoints/endpoint-factory';
import { runPipeline } from './pipeline/pipeline';
import { EndpointInfo } from './pipeline/pipeline-module';
import { ExtendedSchema } from './extended-schema/extended-schema';
import { fetchSchemaMetadata } from './extended-schema/fetch-metadata';

// Not decided on an API to choose this, so leave non-configurable for now
const endpointFactory = new DefaultEndpointFactory();

export async function createProxySchema(config: ProxyConfig): Promise<GraphQLSchema> {

    validateProxyConfig(config);

    const endpoints = await Promise.all(config.endpoints.map(async config => {
        const endpoint = endpointFactory.getEndpoint(config);
        const schema = await endpoint.getSchema();
        const metadata = await fetchSchemaMetadata(endpoint, schema);
        const extendedSchema = new ExtendedSchema(schema, metadata);
        const endpointInfo: EndpointInfo = {
            endpointConfig: config,
            endpoint,
            schema: extendedSchema
        };
        return endpointInfo;
    }));

    return runPipeline(endpoints, endpointFactory).schema;
}

function validateProxyConfig(config: ProxyConfig) {
    // TODO push code to new file/class ProxyConfigValidator
    config.endpoints.forEach(endpointConfig => {
        if (!endpointConfig.identifier && endpointConfig.namespace) endpointConfig.identifier = endpointConfig.namespace;
        if (!endpointConfig.identifier && endpointConfig.url) endpointConfig.identifier = endpointConfig.url;
        if (!endpointConfig.identifier) endpointConfig.identifier = Math.random().toString(36).slice(2)
    })
}
