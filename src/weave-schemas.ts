import { EndpointConfig, WeavingConfig } from './config/weaving-config';
import {
    buildClientSchema, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString, introspectionQuery,
    IntrospectionQuery, parse
} from 'graphql';
import { DefaultClientFactory } from './graphql-client/client-factory';
import { Pipeline } from './pipeline/pipeline';
import { EndpointInfo } from './pipeline/pipeline-module';
import { ExtendedSchema, SchemaMetadata } from './extended-schema/extended-schema';
import { fetchSchemaMetadata } from './extended-schema/fetch-metadata';
import { GraphQLClient } from './graphql-client/graphql-client';
import { assertSuccessfulResult } from './graphql/execution-result';
import { WeavingError, WeavingErrorConsumer } from './config/errors';
import { compact } from './utils/utils';
import { LocalGraphQLClient } from './graphql-client/local-client';
import { transformSchema } from 'graphql-transformer/dist';
import TraceError = require('trace-error');
import {
    shouldAddPlaceholdersOnError, shouldContinueOnError, shouldProvideErrorsInSchema
} from './config/error-handling';
import { WeavingResult } from './weaving-result';

// Not decided on an API to choose this, so leave non-configurable for now
const endpointFactory = new DefaultClientFactory();

export async function weaveSchemas(config: WeavingConfig): Promise<GraphQLSchema> {
    const result = await weaveSchemasExt(config);
    return result.schema;
}

/**
 * Weaves schemas according to a config. If only recoverable errors occurred, these are reported in the result.
 */
export async function weaveSchemasExt(config: WeavingConfig): Promise<WeavingResult> {
    if (shouldContinueOnError(config.errorHandling)) {
        return weaveSchemasContinueOnError(config);
    }
    return weaveSchemasThrowOnError(config);
}

async function weaveSchemasThrowOnError(config: WeavingConfig): Promise<WeavingResult> {
    const pipeline = await createPipeline(config, { consumeError: (error) => { throw error; } });
    const schema = pipeline.schema.schema;
    return {
        schema,
        errors: [], // in throwing mode, no recoverable errors can exists
        hasErrors: false
    };
}

async function weaveSchemasContinueOnError(config: WeavingConfig): Promise<WeavingResult> {
    const errors: WeavingError[] = [];
    function onError(error: WeavingError) {
        errors.push(error);
    }
    const pipeline = await createPipeline(config, { consumeError: onError });
    let schema = pipeline.schema.schema;
    if (shouldProvideErrorsInSchema(config.errorHandling) && errors.length) {
        schema = transformSchema(schema, {
            transformFields(config, context) {
                if (context.oldOuterType == schema.getQueryType()) {
                    return {
                        ...config,
                        _errors: {
                            type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(new GraphQLObjectType({
                                name: '_WeavingError',
                                fields: {
                                    message: {
                                        type: new GraphQLNonNull(GraphQLString)
                                    },
                                    endpoint: {
                                        type: GraphQLString
                                    }
                                }
                            })))),
                            resolve: () => errors.map(e => ({message: e.message, endpoint: e.endpointName}))
                        }
                    };
                }
                return config;
            }
        });
    }

    return {
        schema,
        errors,
        hasErrors: errors.length > 0
    };
}

export async function createPipeline(config: WeavingConfig, errorConsumer: WeavingErrorConsumer): Promise<Pipeline> {
    validateConfig(config);

    const endpoints = await Promise.all(config.endpoints.map(async endpointConfig => {
        const endpoint = endpointFactory.getEndpoint(endpointConfig);
        let schema: GraphQLSchema;
        try {
            schema = await getClientSchema(endpoint);
        } catch (error) {
            const weavingError = new WeavingError(`Failed to retrieve schema: ${error.message}`, endpointConfig, error);
            errorConsumer.consumeError(weavingError);

            // If this is namespaced, we can place a pseudo-field to report errors more visibly
            if (shouldAddPlaceholdersOnError(config.errorHandling) && endpointConfig.namespace) {
                return createPlaceholderEndpoint(endpointConfig, weavingError);
            }

            // otherwise, exclude this endpoint from the result
            return undefined;
        }
        let metadata: SchemaMetadata;
        try {
            metadata = await fetchSchemaMetadata(endpoint, schema);
        } catch (error) {
            errorConsumer.consumeError(new WeavingError(`Failed to retrieve schema metadata: ${error.message}`, endpointConfig, error));
            metadata = new SchemaMetadata();
        }
        const extendedSchema = new ExtendedSchema(schema, metadata);
        const endpointInfo: EndpointInfo = {
            endpointConfig: endpointConfig,
            client: endpoint,
            schema: extendedSchema
        };
        return endpointInfo;
    }));
    const usableEndpoints = compact(endpoints);

    return new Pipeline(usableEndpoints, errorConsumer, config.pipelineConfig);
}

function validateConfig(config: WeavingConfig) {
    // TODO push code to new file/class ProxyConfigValidator
    config.endpoints.forEach(endpointConfig => {
        if (!endpointConfig.identifier && endpointConfig.namespace) {
            endpointConfig.identifier = endpointConfig.namespace;
        }
        if (!endpointConfig.identifier) {
            endpointConfig.identifier = Math.random().toString(36).slice(2);
        }
    });
}

async function getClientSchema(endpoint: GraphQLClient): Promise<GraphQLSchema> {
    const introspectionRes = await endpoint.execute(parse(introspectionQuery), {}, undefined, true);
    const introspection = assertSuccessfulResult(introspectionRes) as IntrospectionQuery;
    try {
        return buildClientSchema(introspection);
    } catch (error) {
        throw new TraceError(`Failed to build schema from introspection result: ${error.message}`, error);
    }
}

function createPlaceholderEndpoint(endpointConfig: EndpointConfig, error: WeavingError): EndpointInfo {
    const schema = createPlaceholderSchema(endpointConfig, error);
    return {
        endpointConfig,
        client: new LocalGraphQLClient(schema),
        schema: new ExtendedSchema(schema)
    };
}

function createPlaceholderSchema(endpoint: EndpointConfig, error: WeavingError): GraphQLSchema {
    return new GraphQLSchema({
        query: new GraphQLObjectType({
            description: 'Failed to fetch the schema for this endpoint. This type only exists to show the error message.',
            name: endpoint.typePrefix ? 'Query' : `Query_${endpoint.identifier}`,
            fields: {
                _error: {
                    type: GraphQLString,
                    resolve: () => error.message
                }
            }
        })
    });
}
