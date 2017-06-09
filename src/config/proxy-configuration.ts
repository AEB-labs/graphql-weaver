import { GraphQLSchema } from 'graphql';
import { capitalize } from '../utils';

export interface ProxyConfigInput {
    port?: number,
    endpoints?: {
        [key: string]: (string | {
            url: string
            typePrefix?: string
            links?: LinkConfigMap
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
    links: LinkConfigMap
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

export type LinkConfigMap = { [typeAndField: string]: LinkTargetConfig | undefined };

export interface LinkTargetConfig {
    endpoint: string
    field: string
    argument: string
    batchMode?: boolean
    keyField?: string
}

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
                    links: {},
                    typePrefix: capitalize(key)
                };
            }
            return {
                links: {},
                typePrefix: capitalize(key),
                ...endpoint,
                name: key
            };
        })
    };
}