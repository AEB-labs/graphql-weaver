import { GraphQLEndpoint } from './graphql-endpoint';
import { query } from './client';
import { buildClientSchema, DocumentNode, introspectionQuery, print } from 'graphql';
import TraceError = require('trace-error');

export class HttpEndpoint implements GraphQLEndpoint {
    public readonly url: string;

    constructor(config: { url: string }) {
        this.url = config.url;
    }

    query(document: DocumentNode, variables?: { [name: string]: any}) {
        return this.query0(print(document), variables);
    }

    protected query0(queryStr: string, variables?: { [name: string]: any}) {
        return query(this.url, queryStr, variables);
    }

    async getSchema() {
        const introspection = await this.query0(introspectionQuery);
        try {
            return buildClientSchema(introspection);
        } catch (error) {
            throw new TraceError(`Failed to build schema from introspection result of ${this.url}: ${error.message}`, error);
        }
    }
}
