import { ProxyConfig } from '../config/proxy-configuration';
import { parse } from 'graphql';
import { DefaultEndpointFactory } from '../endpoints/endpoint-factory';
import {
    EMPTY_INTROSPECTION_QUERY, EXTENDED_INTROSPECTION_QUERY, supportsExtendedIntrospection
} from '../endpoints/extended-introspection';
import { runPipeline } from '../pipeline/pipeline';
import TraceError = require('trace-error');
import { EndpointInfo } from '../pipeline/pipeline-module';

// Not decided on an API to choose this, so leave non-configurable for now
const endpointFactory = new DefaultEndpointFactory();

export async function createProxySchema(config: ProxyConfig) {
    const endpoints = await Promise.all(config.endpoints.map(async config => {
        const endpoint = endpointFactory.getEndpoint(config);
        const schema = await endpoint.getSchema();
        const extendedIntrospection = supportsExtendedIntrospection(schema) ?
            await endpoint.query(parse(EXTENDED_INTROSPECTION_QUERY)) : EMPTY_INTROSPECTION_QUERY;
        const endpointInfo: EndpointInfo = {
            endpointConfig: config,
            endpoint,
            schema,
            extendedIntrospection
        };
        return endpointInfo;
    }));

    return runPipeline(endpoints, endpointFactory);
}
