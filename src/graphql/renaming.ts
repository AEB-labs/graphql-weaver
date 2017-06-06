import { EndpointConfig } from '../config/proxy-configuration';

//const ENDPOINT_TYPE_SEPARATOR = '_';

export function getReverseTypeRenamer(endpoint: EndpointConfig) {
    const prefix = endpoint.typePrefix;
    return (type: string) => {
        if (type.startsWith(prefix)) {
            return type.substr(prefix.length);
        }
        return type;
    };
}

export function getTypePrefix(endpoint: EndpointConfig) {
    return endpoint.typePrefix;
}

// TODO the following two functions should be more efficient

export function splitIntoEndpointAndTypeName(namespacedTypeName: string, endpoints: EndpointConfig[]): { endpointName: string, typeName: string }|undefined {
    for (const endpoint of endpoints) {
        const prefix = getTypePrefix(endpoint);
        if (namespacedTypeName.startsWith(prefix)) {
            return {
                endpointName: endpoint.name,
                typeName: namespacedTypeName.substr(prefix.length)
            };
        }
    }
    return undefined;
}

export function combineEndpointAndTypeName(value: { endpointName: string, typeName: string }, endpoints: EndpointConfig[]) {
    const endpoint = endpoints.filter(endpoint => endpoint.name == value.endpointName)[0];
    return getTypePrefix(endpoint) + value.typeName;
}