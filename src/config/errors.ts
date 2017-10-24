import { EndpointConfig, CustomEndpointConfig, HttpEndpointConfig, LocalEndpointConfig } from './weaving-config';

export class WeavingError extends Error {
    constructor(message: string, public readonly endpoint?: EndpointConfig, public readonly originalError?: Error) {
        super(message);
        Object.setPrototypeOf(this, WeavingError.prototype);
    }

    get endpointName(): string|undefined {
        if (!this.endpoint) {
            return undefined;
        }
        if (this.endpoint.namespace) {
            return this.endpoint.namespace;
        }
        if ((this.endpoint as HttpEndpointConfig).url) {
            return (this.endpoint as HttpEndpointConfig).url;
        }
        return this.endpoint.identifier;
    }
}

export interface WeavingErrorConsumer {
    consumeError(error: WeavingError): void;
}
