import { GraphQLSchema } from 'graphql';
import { capitalize } from '../utils';
import { FieldMetadata } from '../endpoints/extended-introspection';

export interface ProxyConfigInput {
    port?: number,
    endpoints?: {
        [key: string]: (string | {
            url: string
            typePrefix?: string
            fieldMetadata?: {[key: string]: FieldMetadata}
        })
    };
}

export interface ProxyConfig {
    port: number
    endpoints: EndpointConfig[]
}

interface EndpointConfigBase {
    name: string
    typePrefix: string
    fieldMetadata?: {[key: string]: FieldMetadata}
    url?: string
    schema?: GraphQLSchema
}

interface HttpEndpointConfig extends EndpointConfigBase {
    url: string
}

interface LocalEndpointConfig extends EndpointConfigBase {
    schema: GraphQLSchema
}

export type EndpointConfig = HttpEndpointConfig | LocalEndpointConfig;


const DEFAULT_PORT = 3200;

export function normalizeProxyConfig(input: ProxyConfigInput) {
    return {
        port: input.port || DEFAULT_PORT,
        endpoints: Object.keys(input.endpoints || {}).map(key => {
            const endpoint = input.endpoints![key];
            if (typeof endpoint == 'string') {
                return {
                    name: key,
                    url: endpoint,
                    typePrefix: capitalize(key)
                };
            }
            return {
                typePrefix: capitalize(key),
                ...endpoint,
                name: key
            };
        })
    };
}