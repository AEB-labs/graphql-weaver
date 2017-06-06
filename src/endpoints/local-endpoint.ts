import { GraphQLEndpoint } from './graphql-endpoint';
import { DocumentNode, execute, GraphQLSchema } from 'graphql';

export class LocalEndpoint implements GraphQLEndpoint {
    constructor(public readonly schema: GraphQLSchema) {

    }

    async query(query: DocumentNode, variables?: { [name: string]: any }) {
        return execute(this.schema, query, {}, {}, variables);
    }

    async getSchema() {
        return this.schema;
    }
}
