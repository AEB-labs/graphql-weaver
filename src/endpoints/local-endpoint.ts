import { GraphQLEndpoint } from './graphql-endpoint';
import { DocumentNode, execute, GraphQLSchema, validate } from 'graphql';
import { assertSuccessfulResponse } from './client';

export class LocalEndpoint implements GraphQLEndpoint {
    constructor(public readonly schema: GraphQLSchema) {

    }

    async query(query: DocumentNode, variables?: { [name: string]: any }, context?: any) {
        const validationErrors = validate(this.schema, query);
        let result;
        if (validationErrors.length > 0) {
            result = {errors: validationErrors};
        } else {
            result = await execute(this.schema, query, {}, context, variables);
        }
        assertSuccessfulResponse(result);
        return result.data;
    }
}
