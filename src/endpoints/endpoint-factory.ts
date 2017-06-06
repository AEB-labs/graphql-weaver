import { EndpointConfig } from '../config/proxy-configuration';
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
        if (config.url) {
            return new HttpEndpoint({url: config.url});
        }
        if (config.schema) {
            return new LocalEndpoint(config.schema);
        }
        throw new Error(`Unsupported endpoint config`);
    }
}
