import { DocumentNode, GraphQLSchema } from 'graphql';

/**
 * An object that provides query and introspetion access to a GraphQL endpoint
 */
export interface GraphQLEndpoint {
    /**
     * Performs a GraphQL query against the endpoint
     * @param query the query string in the GraphQL language
     * @param variables an optional map of key-value pairs for variables
     */
    query(query: DocumentNode, variables?: { [name: string]: any }, context?: any): Promise<any>;

    /**
     * Fetches the schema of the endpoint. May not be cached.
     */
    getSchema(): Promise<GraphQLSchema>
}
