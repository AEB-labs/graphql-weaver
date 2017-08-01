import {
    CustomEndpointConfig, EndpointConfig, HttpEndpointConfig, LocalEndpointConfig
} from '../config/proxy-configuration';
import { GraphQLClient } from './graphql-client';
import { HttpGraphQLClient } from './http-client';
import { LocalGraphQLClient } from './local-client';

/**
 * A factory that creates active GraphQLEndpoints from passive config objects
 */
export interface ClientFactory {
    getEndpoint(config: EndpointConfig): GraphQLClient;
}

export class DefaultClientFactory implements ClientFactory {
    getEndpoint(config: EndpointConfig) {
        if (isHttpEndpointConfig(config)) {
            return new HttpGraphQLClient({url: config.url});
        }
        if (isLocalEndpointConfig(config)) {
            return new LocalGraphQLClient(config.schema);
        }
        if (isCustomEndpointConfig(config)) {
            return config.client;
        }
        throw new Error(`Unsupported endpoint config`);
    }
}

function isLocalEndpointConfig(config: EndpointConfig): config is LocalEndpointConfig {
    return 'schema' in config;
}

function isHttpEndpointConfig(config: EndpointConfig): config is HttpEndpointConfig {
    return 'url' in config;
}

function isCustomEndpointConfig(config: EndpointConfig): config is CustomEndpointConfig{
    return 'client' in config;
}
