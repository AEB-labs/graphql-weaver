import { GraphQLEndpoint } from './graphql-endpoint';
import { assertSuccessfulResponse } from './client';
import { DocumentNode, print } from 'graphql';
import fetch, { HeaderInit, Request } from 'node-fetch';
import TraceError = require('trace-error');

export class HttpEndpoint implements GraphQLEndpoint {
    public readonly url: string;

    constructor(config: { url: string }) {
        this.url = config.url;
    }

    async query(document: DocumentNode, variables?: { [name: string]: any }, context?: any) {
        let res;
        try {
            res = await this.fetch(this.getRequest(document, variables, context));
        } catch (error) {
            throw new TraceError(`Error connecting to GraphQL endpoint at ${this.url}: ${error.message}`, error);
        }
        if (!res.ok) {
            if (res.headers.get('Content-Type') == 'application/json') {
                // try to parse for a GraphQL response with errors
                let json;
                try {
                    json = await res.json();
                } catch (error) {
                    // fall through
                }
                if (json) {
                    assertSuccessfulResponse(json);
                }
                // if it was indeed a successful response, something is odd (res.ok should have been true), so report HTTP error
            }

            throw new Error(`GraphQL endpoint at ${this.url} reported ${res.status} ${res.statusText}`);
        }

        let json;
        try {
            json = await res.json();
        } catch (error) {
            throw new TraceError(`Response from GraphQL endpoint at ${this.url} is invalid json: ${error.message}`, error);
        }
        assertSuccessfulResponse(json);
        return json.data;
    }

    protected fetch = fetch;

    protected getRequest(document: DocumentNode, variables?: { [name: string]: any }, context?: any): Request {
        return new Request(this.url, {
            method: 'POST',
            headers: this.getHeaders(document, variables, context),
            body: this.getBody(document, variables, context)
        })
    }

    protected getHeaders(document: DocumentNode, variables?: { [name: string]: any }, context?: any): HeaderInit | { [index: string]: string } {
        return {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        };
    }

    protected getBody(document: DocumentNode, variables?: { [name: string]: any }, context?: any): any {
        return JSON.stringify({
            query: print(document),
            variables
        });
    }
}
