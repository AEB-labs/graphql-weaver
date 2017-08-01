import { GraphQLSchema } from 'graphql';
import { FieldMetadata } from '../extended-schema/extended-schema';
import { GraphQLClient } from '../graphql-client/graphql-client';

/**
 * The configuration for creating a proxy schema
 */
export interface ProxyConfig {
    /**
     * A list of endpoints to include in the schema
     */
    endpoints: EndpointConfig[]
}

interface EndpointConfigBase {
    /**
     * If defined, all root fields of this endpoint will be wrapped in a field called ${namespace} on the root types.
     * If undefined, the root fields of this endpoint will be merged into the root operation types.
     */
    namespace?: string

    /**
     * If defined, all type names of this endpoint will be prefixed with this string
     */
    typePrefix?: string

    /**
     * Specifies custom metadata for fields of this endpoint. The key should be of format `typeName.fieldName`.
     */
    fieldMetadata?: {[key: string]: FieldMetadata}

    /**
     * An optional unique identifier for this endpoint. If undefined, a random identifier will be used
     */
    identifier?: string
}

export interface CustomEndpointConfig extends EndpointConfigBase {
    /**
     * A GraphQLClient implementation that is used to execute GraphQL queries
     */
    client: GraphQLClient
}

export interface HttpEndpointConfig extends EndpointConfigBase {
    /**
     * The URL of a GraphQL HTTP server that is used via POST to execute GraphQL queries
     */
    url: string
}

export interface LocalEndpointConfig extends EndpointConfigBase {
    /**
     * A GraphQL schema that is used to execute GraphQL queries
     */
    schema: GraphQLSchema
}

export type EndpointConfig = HttpEndpointConfig | LocalEndpointConfig | CustomEndpointConfig;
