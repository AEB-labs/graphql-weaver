// Main function
export { weaveSchemas, weaveSchemas as createProxySchema } from './src/weave-schemas';

// Configuration
export { WeavingConfig, WeavingConfig as ProxyConfig, EndpointConfig } from './src/config/weaving-config';
export {
    PipelineConfig, PreMergeModuleContext, PostMergeModuleContext, PipelineModule
} from './src/pipeline/pipeline-module';

// GraphQL client
export { GraphQLClient } from './src/graphql-client/graphql-client';
export { HttpGraphQLClient } from './src/graphql-client/http-client';
export { LocalGraphQLClient } from './src/graphql-client/local-client';

// Extended schema
export { ExtendedSchema, FieldMetadata, LinkConfig, SchemaMetadata } from './src/extended-schema/extended-schema';
export {
    EXTENDED_INTROSPECTION_FIELD, getExtendedIntrospectionType, getExtendedIntrospectionData
} from './src/extended-schema/extended-introspection';

// Utilities to write modules
export {
    ExtendedSchemaTransformer, transformExtendedSchema, GraphQLFieldConfigMapWithMetadata,
    GraphQLFieldConfigWithMetadata, GraphQLNamedFieldConfigWithMetadata
} from './src/extended-schema/extended-schema-transformer';
export { Query } from './src/graphql/common';
export {
    SchemaTransformer, transformSchema, FieldsTransformationContext, DirectiveTransformationContext,
    FieldTransformationContext, GraphQLNamedFieldConfig, GraphQLNamedInputFieldConfig, InputFieldTransformationContext,
    TypeTransformationContext, SchemaTransformationContext
} from './src/graphql/schema-transformer';

// some useful modules
export { NamespaceModule }from './src/pipeline/namespaces';
export { TypePrefixesModule }from './src/pipeline/type-prefixes';
export { LinksModule }from './src/pipeline/links';