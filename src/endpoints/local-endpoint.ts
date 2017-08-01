import { GraphQLEndpoint } from './graphql-endpoint';
import { DocumentNode, execute, GraphQLSchema, validate } from 'graphql';

export class LocalEndpoint implements GraphQLEndpoint {
    constructor(public readonly schema: GraphQLSchema) {

    }

    async query(query: DocumentNode, variables?: { [name: string]: any }, context?: any) {
        const validationErrors = validate(this.schema, query);
        if (validationErrors.length > 0) {
            return {errors: validationErrors};
        } else {
            return await execute(this.schema, query, {}, context, variables);
        }
    }
}
