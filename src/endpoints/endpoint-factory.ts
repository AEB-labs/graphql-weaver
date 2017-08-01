import {
    CustomEndpointConfig, EndpointConfig, HttpEndpointConfig, LocalEndpointConfig
} from '../config/proxy-configuration';
import { GraphQLEndpoint } from './graphql-endpoint';
import { HttpEndpoint } from './http-endpoint';
import { LocalEndpoint } from './local-endpoint';

/**
 * A factory that creates active GraphQLEndpoints from passive config objects
 */
export interface EndpointFactory {
    getEndpoint(config: EndpointConfig): GraphQLEndpoint;
}

export class DefaultEndpointFactory implements EndpointFactory {
    getEndpoint(config: EndpointConfig) {
        if (isHttpEndpointConfig(config)) {
            return new HttpEndpoint({url: config.url});
        }
        if (isLocalEndpointConfig(config)) {
            return new LocalEndpoint(config.schema);
        }
        if (isCustomEndpointConfig(config)) {
            return config.endpoint;
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
    return 'endpoint' in config;
}
