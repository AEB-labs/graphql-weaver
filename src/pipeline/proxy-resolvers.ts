import { PipelineModule } from './pipeline-module';
import { FieldTransformationContext, GraphQLNamedFieldConfig, SchemaTransformer } from '../graphql/schema-transformer';
import { GraphQLSchema, GraphQLType } from 'graphql';
import { getFieldAsQuery, getFieldAsQueryParts, getQueryFromParts } from '../graphql/field-as-query';
import { GraphQLEndpoint } from '../endpoints/graphql-endpoint';
import { Query } from '../graphql/common';
import { EndpointConfig } from '../config/proxy-configuration';
import { createSelectionChain } from '../graphql/language-utils';

interface Config {
    readonly endpoint: GraphQLEndpoint
    processQuery(query: Query, endpointName: string): Query
    readonly endpointConfig: EndpointConfig
}

/**
 * Adds resolvers to the top-level fields of all root types that proxy the request to a specified endpoint
 */
export class ProxyResolversModule implements PipelineModule {
    constructor(private readonly config: Config) {

    }

    getSchemaTransformer() {
        return new ResolverTransformer(this.config)
    }
}

class ResolverTransformer implements SchemaTransformer {
    constructor(private readonly config: Config) {

    }

    transformField(config: GraphQLNamedFieldConfig<any, any>, context: FieldTransformationContext): GraphQLNamedFieldConfig<any, any> {
        if (!isRootType(context.oldOuterType, context.oldSchema)) {
            return config;
        }

        return {
            ...config,
            resolve: async (source, args, context, info) => {
                // wrap selection into field being resolved
                const { selectionSet, ...parts} = getFieldAsQueryParts(info);
                const newSelectionSet = createSelectionChain([config.name], selectionSet);
                let query = getQueryFromParts({...parts, selectionSet: newSelectionSet});

                query = this.config.processQuery(query, this.config.endpointConfig.namespace);
                return await this.config.endpoint.query(query.document, query.variableValues);
            }
        };
    }
}

/**
 * Determines whether the given type is one of the operation root types (query, mutation, subscription) of a schema
 */
function isRootType(type: GraphQLType, schema: GraphQLSchema) {
    return type == schema.getQueryType() ||
        type == schema.getMutationType() ||
        type == schema.getSubscriptionType();
}
