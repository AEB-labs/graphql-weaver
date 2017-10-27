import { EndpointConfig, CustomEndpointConfig, HttpEndpointConfig, LocalEndpointConfig } from './weaving-config';

/**
 * An error that occurred while weaving an endpoint
 */
export class WeavingError extends Error {
    constructor(message: string, public readonly endpoint?: EndpointConfig, public readonly originalError?: Error) {
        super(message);
        Object.setPrototypeOf(this, WeavingError.prototype);
    }

    /**
     * A human-readable name of the endpoint, as long one can be found
     * @returns {string}
     */
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

export type WeavingErrorConsumer = (error: WeavingError) => void;

export const throwingErrorConsumer: WeavingErrorConsumer = e => { throw e; }