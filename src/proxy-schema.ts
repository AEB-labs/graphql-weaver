import { ProxyConfig } from './config/proxy-configuration';
import { buildClientSchema, GraphQLSchema, introspectionQuery, IntrospectionQuery, parse } from 'graphql';
import { DefaultClientFactory } from './graphql-client/client-factory';
import { runPipeline } from './pipeline/pipeline';
import { EndpointInfo } from './pipeline/pipeline-module';
import { ExtendedSchema } from './extended-schema/extended-schema';
import { fetchSchemaMetadata } from './extended-schema/fetch-metadata';
import { GraphQLClient } from './graphql-client/graphql-client';
import TraceError = require('trace-error');
import { assertSuccessfulResult } from './graphql/execution-result';

// Not decided on an API to choose this, so leave non-configurable for now
const endpointFactory = new DefaultClientFactory();

export async function createProxySchema(config: ProxyConfig): Promise<GraphQLSchema> {
    validateProxyConfig(config);

    const endpoints = await Promise.all(config.endpoints.map(async config => {
        const endpoint = endpointFactory.getEndpoint(config);
        const schema = await getClientSchema(endpoint);
        const metadata = await fetchSchemaMetadata(endpoint, schema);
        const extendedSchema = new ExtendedSchema(schema, metadata);
        const endpointInfo: EndpointInfo = {
            endpointConfig: config,
            client: endpoint,
            schema: extendedSchema
        };
        return endpointInfo;
    }));

    return runPipeline(endpoints, config.pipelineConfig).schema;
}

function validateProxyConfig(config: ProxyConfig) {
    // TODO push code to new file/class ProxyConfigValidator
    config.endpoints.forEach(endpointConfig => {
        if (!endpointConfig.identifier && endpointConfig.namespace) {
            endpointConfig.identifier = endpointConfig.namespace;
        }
        if (!endpointConfig.identifier) {
            endpointConfig.identifier = Math.random().toString(36).slice(2)
        }
    })
}

async function getClientSchema(endpoint: GraphQLClient): Promise<GraphQLSchema> {
    const introspectionRes = await endpoint.execute(parse(introspectionQuery), {}, { introspection: true });
    const introspection = assertSuccessfulResult(introspectionRes) as IntrospectionQuery;
    try {
        return buildClientSchema(introspection);
    } catch (error) {
        throw new TraceError(`Failed to build schema from introspection result: ${error.message}`, error);
    }
}
