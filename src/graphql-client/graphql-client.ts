import { DocumentNode } from 'graphql';
import { ClientExecutionResult } from './client-execution-result';

/**
 * An object that provides access to a GraphQL endpoint
 */
export interface GraphQLClient {
    /**
     * Performs a GraphQL query against the endpoint
     * @param query the query string in the GraphQL language
     * @param variables an optional map of key-value pairs for variables
     * @param context the context value that has been originally passed to the schema executor
     * @param introspect set to true when executing an introspection query
     */
    execute(query: DocumentNode, variables?: { [name: string]: any }, context?: any, introspect?: boolean): Promise<ClientExecutionResult>;
}
