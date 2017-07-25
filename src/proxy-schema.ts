import { ProxyConfig } from './config/proxy-configuration';
import { GraphQLSchema, parse } from 'graphql';
import { DefaultEndpointFactory } from './endpoints/endpoint-factory';
import {
    buildSchemaMetadata, EXTENDED_INTROSPECTION_FIELD, EXTENDED_INTROSPECTION_QUERY, supportsExtendedIntrospection
} from './extended-schema/extended-introspection';
import { Pipeline } from './pipeline/pipeline';
import { EndpointInfo } from './pipeline/pipeline-module';
import { ExtendedSchema, SchemaMetadata } from './extended-schema/extended-schema';
import { GraphQLEndpoint } from './endpoints/graphql-endpoint';

// Not decided on an API to choose this, so leave non-configurable for now
const endpointFactory = new DefaultEndpointFactory();

export async function createProxySchema(config: ProxyConfig): Promise<GraphQLSchema> {
    const pipeline = await createPipeline(config);
    return pipeline.schema.schema;
}

export async function createPipeline(config: ProxyConfig): Promise<Pipeline> {
    validateProxyConfig(config);

    const endpoints = await Promise.all(config.endpoints.map(async config => {
        const endpoint = endpointFactory.getEndpoint(config);
        const schema = await endpoint.getSchema();
        const metadata = await getMetadata(schema, endpoint);
        const extendedSchema = new ExtendedSchema(schema, metadata);
        const endpointInfo: EndpointInfo = {
            endpointConfig: config,
            endpoint,
            schema: extendedSchema
        };
        return endpointInfo;
    }));

    return new Pipeline(endpoints, endpointFactory);
}

function validateProxyConfig(config: ProxyConfig) {
    // TODO push code to new file/class ProxyConfigValidator
    config.endpoints.forEach(endpointConfig => {
        if (!endpointConfig.identifier && endpointConfig.namespace) endpointConfig.identifier = endpointConfig.namespace;
        if (!endpointConfig.identifier && endpointConfig.url) endpointConfig.identifier = endpointConfig.url;
        if (!endpointConfig.identifier) endpointConfig.identifier = Math.random().toString(36).slice(2)
    })
}

async function getMetadata(schema: GraphQLSchema, endpoint: GraphQLEndpoint) {
    if (!supportsExtendedIntrospection(schema)) {
        return new SchemaMetadata();
    }
    const result = await endpoint.query(parse(EXTENDED_INTROSPECTION_QUERY));
    return buildSchemaMetadata(result[EXTENDED_INTROSPECTION_FIELD]);
}
