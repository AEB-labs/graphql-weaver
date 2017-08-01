import { GraphQLEndpoint } from './graphql-endpoint';
import { query } from './client';
import { DocumentNode, print } from 'graphql';

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
}
