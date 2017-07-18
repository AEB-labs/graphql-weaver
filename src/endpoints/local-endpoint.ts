import { GraphQLEndpoint } from './graphql-endpoint';
import {
    buildClientSchema, DocumentNode, execute, GraphQLSchema, IntrospectionQuery, introspectionQuery, parse
} from 'graphql';
import { assertSuccessfulResponse } from './client';

export class LocalEndpoint implements GraphQLEndpoint {
    constructor(public readonly schema: GraphQLSchema) {

    }

    async query(query: DocumentNode, variables?: { [name: string]: any }, context?: any) {
        const result = await execute(this.schema, query, {}, context, variables);
        assertSuccessfulResponse(result);
        return result.data;
    }

    async getSchema() {
        // Don't return schema directly but get a client schema so that resolvers are not passed over
        const introspectionResult = await execute(this.schema, parse(introspectionQuery));
        assertSuccessfulResponse(introspectionResult);
        return buildClientSchema(introspectionResult.data as IntrospectionQuery);
    }
}
