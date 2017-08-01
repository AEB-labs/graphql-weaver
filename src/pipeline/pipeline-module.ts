import { GraphQLSchema } from 'graphql';
import { EndpointConfig } from '../config/proxy-configuration';
import { GraphQLEndpoint } from '../endpoints/graphql-endpoint';
import { ExtendedSchema } from '../extended-schema/extended-schema';
import { EndpointFactory } from '../endpoints/endpoint-factory';
import { Query } from '../graphql/common';
import { ExtendedSchemaTransformer, transformExtendedSchema } from '../extended-schema/extended-schema-transformer';

/**
 * Part of the pipeline that transforms both the schema and queries/resolvers
 */
export interface PipelineModule extends SchemaPipelineModule, QueryPipelineModule {
}

export interface SchemaPipelineModule {
    transformSchema?(schema: GraphQLSchema): GraphQLSchema;
    transformExtendedSchema?(schema: ExtendedSchema): ExtendedSchema;

    /**
     * If defined, is called on each root schema. If the result of the defined method is undefined, the schema is left untouched.
     */
    getSchemaTransformer?(): ExtendedSchemaTransformer | undefined;
}

export interface QueryPipelineModule {
    /**
     * If defined, is called on a query executed by the proxy resolver
     */
    transformQuery?(node: Query): Query;
}

export function runQueryPipelineModule(module: QueryPipelineModule, query: Query) {
    if (module.transformQuery) {
        query = module.transformQuery(query);
    }

    return query;
}

export function runQueryPipeline(modules: QueryPipelineModule[], query: Query) {
    return modules.reduce((query, module) => runQueryPipelineModule(module, query), query);
}

export function runSchemaPipelineModule(module: SchemaPipelineModule, schema: ExtendedSchema) {
    if (module.transformExtendedSchema) {
        schema = module.transformExtendedSchema(schema);
    }
    if (module.transformSchema) {
        schema = schema.withSchema(module.transformSchema(schema.schema));
    }
    if (module.getSchemaTransformer) {
        const transformer = module.getSchemaTransformer();
        if (transformer) {
            schema = transformExtendedSchema(schema, transformer);
        }
    }
    return schema;
}

export function runSchemaPipeline(modules: SchemaPipelineModule[], schema: ExtendedSchema) {
    // TODO be more efficient by combining schema transformers if possible
    return modules.reduce((schema, module) => runSchemaPipelineModule(module, schema), schema);
}

export interface EndpointInfo {
    endpointConfig: EndpointConfig
    endpoint: GraphQLEndpoint
    schema: ExtendedSchema
}

export interface PreMergeModuleContext {
    endpointConfig: EndpointConfig
    endpoint: GraphQLEndpoint
    processQuery(query: Query, endpointIdentifier: string): Query;
}

export interface PostMergeModuleContext {
    //???
    endpoints: PreMergeModuleContext[]
    endpointFactory: EndpointFactory // TODO redundant with endpoint in EndpointInfo

    processQuery(query: Query, endpointIdentifier: string): Query
}

export type PreMergeModuleFactory = (context: PreMergeModuleContext) => PipelineModule
export type PostMergeModuleFactory = (context: PostMergeModuleContext) => PipelineModule
