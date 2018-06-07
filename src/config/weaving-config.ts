import { GraphQLSchema } from 'graphql';
import { FieldMetadata } from '../extended-schema/extended-schema';
import { GraphQLClient } from '../graphql-client/graphql-client';
import { PipelineConfig } from '../pipeline/pipeline-module';
import { WeavingErrorHandlingMode } from './error-handling';

/**
 * The configuration for weaving schemas
 */
export interface WeavingConfig {
    /**
     * A list of endpoints to include in the schema
     */
    readonly endpoints: ReadonlyArray<EndpointConfig>

    /**
     * Custom configuration of the pipeline
     */
    readonly pipelineConfig?: PipelineConfig

    /**
     * Configures what should happen when a recoverable error occurs during weaving. Does not affect unexpected errors
     * that indicate bugs, those are always thrown. Default value: THROW
     */
    readonly errorHandling?: WeavingErrorHandlingMode;
}

export interface EndpointConfigBase {
    /**
     * If defined, all root fields of this endpoint will be wrapped in a field called ${namespace} on the root types.
     * If undefined, the root fields of this endpoint will be merged into the root operation types.
     */
    readonly namespace?: string

    /**
     * If defined, all type names of this endpoint will be prefixed with this string
     */
    readonly typePrefix?: string

    /**
     * Specifies custom metadata for fields of this endpoint. The key should be of format `typeName.fieldName`.
     */
    readonly fieldMetadata?: {readonly [key: string]: FieldMetadata}

    /**
     * An optional unique identifier for this endpoint. If undefined, a random identifier will be used
     */
    identifier?: string
}

export interface CustomEndpointConfig extends EndpointConfigBase {
    /**
     * A GraphQLClient implementation that is used to execute GraphQL queries
     */
    readonly client: GraphQLClient
}

export interface HttpEndpointConfig extends EndpointConfigBase {
    /**
     * The URL of a GraphQL HTTP server that is used via POST to execute GraphQL queries
     */
    readonly url: string
}

export interface LocalEndpointConfig extends EndpointConfigBase {
    /**
     * A GraphQL schema that is used to execute GraphQL queries
     */
    readonly schema: GraphQLSchema|Promise<GraphQLSchema>
}

export type EndpointConfig = HttpEndpointConfig | LocalEndpointConfig | CustomEndpointConfig;
