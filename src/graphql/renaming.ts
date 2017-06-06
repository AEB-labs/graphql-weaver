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

export function splitIntoEndpointAndTypeName(namespacedTypeName: string): { endpointName: string, typeName: string }|undefined {
    const [ endpointName, typeName ] = namespacedTypeName.split(ENDPOINT_TYPE_SEPARATOR, 2);
    if (endpointName == undefined || typeName == undefined) {
        return undefined;
    }
    return { endpointName, typeName };
}

export function combineEndpointAndTypeName(value: { endpointName: string, typeName: string }) {
    return value.endpointName + ENDPOINT_TYPE_SEPARATOR + value.typeName;
}