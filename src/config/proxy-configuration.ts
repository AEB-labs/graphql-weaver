export interface ProxyConfigInput {
    port?: number,
    endpoints?: {
        [key: string]: (string | {
            url: string
            links?: LinkConfigMap
        })
    };
}

export interface ProxyConfig {
    port: number
    endpoints: EndpointConfig[]
}

export interface EndpointConfig {
    name: string
    url: string
    links: LinkConfigMap
}

export type LinkConfigMap = { [typeAndField: string]: LinkTargetConfig | undefined };

export interface LinkTargetConfig {
    endpoint: string
    field: string
    argument: string
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
                    links: {}
                };
            }
            return {
                links: {},
                ...endpoint,
                name: key
            };
        })
    };
}