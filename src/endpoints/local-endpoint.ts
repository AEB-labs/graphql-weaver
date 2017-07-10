import { GraphQLEndpoint } from './graphql-endpoint';
import { DocumentNode, execute, GraphQLSchema, print } from 'graphql';
import { assertSuccessfulResponse } from './client';
import {GraphQLNamedFieldConfig, transformSchema} from "../graphql/schema-transformer";

export class LocalEndpoint implements GraphQLEndpoint {
    constructor(public readonly schema: GraphQLSchema) {

    }

    async query(query: DocumentNode, variables?: { [name: string]: any }, context?: any) {
        const result = await execute(this.schema, query, {}, context, variables);
        assertSuccessfulResponse(result);
        return result.data;
    }

    async getSchema() {
        // Remove resolvers because this schema should not be used to execute queries
        return transformSchema(this.schema, {
            transformField(config: GraphQLNamedFieldConfig<any, any>) {
                return {
                    ...config,
                    resolve: undefined
                }
            }
        });
    }
}
