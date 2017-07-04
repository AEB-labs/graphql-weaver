import { ProxyConfig } from './config/proxy-configuration';
import { GraphQLSchema, parse } from 'graphql';
import { DefaultEndpointFactory } from './endpoints/endpoint-factory';
import {
    EMPTY_INTROSPECTION_QUERY, EXTENDED_INTROSPECTION_QUERY, ExtendedIntrospectionQuery, supportsExtendedIntrospection
} from './extended-schema/extended-introspection';
import { runPipeline } from './pipeline/pipeline';
import { EndpointInfo } from './pipeline/pipeline-module';
import { ExtendedSchema } from './extended-schema/extended-schema';
import TraceError = require('trace-error');

// Not decided on an API to choose this, so leave non-configurable for now
const endpointFactory = new DefaultEndpointFactory();

export async function createProxySchema(config: ProxyConfig): Promise<GraphQLSchema> {
    const endpoints = await Promise.all(config.endpoints.map(async config => {
        const endpoint = endpointFactory.getEndpoint(config);
        const schema = await endpoint.getSchema();
        const extendedIntrospection: ExtendedIntrospectionQuery = supportsExtendedIntrospection(schema) ?
            await endpoint.query(parse(EXTENDED_INTROSPECTION_QUERY)) : EMPTY_INTROSPECTION_QUERY;
        const extendedSchema = ExtendedSchema.fromIntrospection(schema, extendedIntrospection);
        const endpointInfo: EndpointInfo = {
            endpointConfig: config,
            endpoint,
            schema: extendedSchema
        };
        return endpointInfo;
    }));

    return runPipeline(endpoints, endpointFactory).schema;
}
