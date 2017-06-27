import { ASTNode, DocumentNode, GraphQLSchema, TypeInfo } from 'graphql';
import { SchemaTransformer, transformSchema } from '../graphql/schema-transformer';
import { EndpointConfig } from '../config/proxy-configuration';
import { GraphQLEndpoint } from '../endpoints/graphql-endpoint';
import { ExtendedIntrospectionQuery, ExtendedSchema } from '../endpoints/extended-introspection';
import { EndpointFactory } from '../endpoints/endpoint-factory';
import { Query } from '../graphql/common';
import { transformExtendedSchema } from '../graphql/extended-schema-transformer';

/**
 * Part of the pipeline that transforms both the schema and queries/resolvers
 */
export interface PipelineModule extends SchemaPipelineModule, QueryPipelineModule {
}

export interface SchemaPipelineModule {
    transformSchema?(schema: GraphQLSchema): GraphQLSchema;
    transformExtendedSchema?(schema: ExtendedSchema): ExtendedSchema;

    getSchemaTransformer?(): SchemaTransformer;
}

export interface QueryPipelineModule {
    /**
     * If defined, is called on each root node of a proxied field - on all fieldNodes, the fragments and variables
     * @param node the node to process
     * @return the new node to replace the old one
     */
    transformNode?(node: ASTNode): ASTNode;

    /**
     * If defined, is called on each root node of a proxied field - on all fieldNodes, the fragments and variables.
     *
     * In contrast to {@link transformNode(ASTNode)}, this method is more expensive as a TypeInfo instance has to be
     * prepared.
     *
     * @param node
     * @param typeInfo a TypeInfo instance that is initialized at the node and can be used with visitWithTypeInfo
     */
    transformNodeWithTypeInfo?(node: ASTNode, typeInfo: TypeInfo): ASTNode;
}

export function runQueryPipelineModule(module: QueryPipelineModule, query: Query) {
    // which schema?
    if (module.transformNode) {
        query = {
            ...query,
            document: <DocumentNode>module.transformNode(query.document)
        };
    }
    /*if (module.transformNodeWithTypeInfo) {
        // don't think we really have the correct schema here. Also, type-info-initializer anywhere?
        const typeInfo = new TypeInfo(schema);
        query = {
            ...query,
            document: <DocumentNode>module.transformNodeWithTypeInfo(query.document, typeInfo)
        };
    }*/

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
        schema = transformExtendedSchema(schema, transformer);
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
    processQuery(query: Query, endpointName: string): Query;
}

export interface PostMergeModuleContext {
    //???
    endpoints: PreMergeModuleContext[]
    endpointFactory: EndpointFactory // TODO redundant with endpoint in EndpointInfo

    processQuery(query: Query, endpointName: string): Query
}

export type PreMergeModuleFactory = (context: PreMergeModuleContext) => PipelineModule
export type PostMergeModuleFactory = (context: PostMergeModuleContext) => PipelineModule
