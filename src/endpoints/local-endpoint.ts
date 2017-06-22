import { GraphQLEndpoint } from './graphql-endpoint';
import { DocumentNode, execute, GraphQLSchema, print } from 'graphql';
import { assertSuccessfulResponse } from './client';

export class LocalEndpoint implements GraphQLEndpoint {
    constructor(public readonly schema: GraphQLSchema) {

    }

    async query(query: DocumentNode, variables?: { [name: string]: any }, context?: any) {
        console.log('Local');
        console.log(print(query));
        const result = await execute(this.schema, query, {}, context, variables);
        assertSuccessfulResponse(result);
        console.log(result);
        return result.data;
    }

    async getSchema() {
        return this.schema;
    }
}
