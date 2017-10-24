import { GraphQLClient } from './graphql-client';
import {DocumentNode, execute, ExecutionResult, GraphQLSchema, validate} from 'graphql';

export class LocalGraphQLClient implements GraphQLClient {
    constructor(public readonly schema: GraphQLSchema|Promise<GraphQLSchema>) {

    }

    async execute(query: DocumentNode, variables?: { [name: string]: any }, context?: any): Promise<ExecutionResult> {
        const schema = await this.schema;
        const validationErrors = validate(schema, query);
        if (validationErrors.length > 0) {
            return {errors: validationErrors};
        } else {
            return await execute(schema, query, {}, context, variables);
        }
    }
}
