import { DocumentNode, ExecutionResult } from 'graphql';

/**
 * An object that provides access to a GraphQL endpoint
 *
 * TODO fni find better name
 */
export interface GraphQLEndpoint {
    /**
     * Performs a GraphQL query against the endpoint
     * @param query the query string in the GraphQL language
     * @param variables an optional map of key-value pairs for variables
     * @param context the context value that has been originally passed to the schema executor
     */
    execute(query: DocumentNode, variables?: { [name: string]: any }, context?: any): Promise<ExecutionResult>;
}
