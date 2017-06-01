import { EndpointConfig } from '../config/proxy-configuration';

const ENDPOINT_TYPE_SEPARATOR = '_';

export function getReverseTypeRenamer(endpoint: EndpointConfig) {
    const prefix = endpoint.name + ENDPOINT_TYPE_SEPARATOR;
    return (type: string) => {
        if (type.startsWith(prefix)) {
            return type.substr(prefix.length);
        }
        return type;
    };
}

export function getTypePrefix(endpoint: EndpointConfig) {
    return endpoint.name + ENDPOINT_TYPE_SEPARATOR
}