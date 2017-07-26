import { GraphQLSchema } from 'graphql';
import { FieldMetadata } from '../../src/extended-schema/extended-schema';

export interface ProxyConfig {
    endpoints: EndpointConfig[]
}

interface EndpointConfigBase {
    namespace?: string
    typePrefix?: string
    fieldMetadata?: {[key: string]: FieldMetadata}
    url?: string
    schema?: GraphQLSchema
    identifier?: string
}

interface HttpEndpointConfig extends EndpointConfigBase {
    url: string
}

interface LocalEndpointConfig extends EndpointConfigBase {
    schema: GraphQLSchema
}

export type EndpointConfig = HttpEndpointConfig | LocalEndpointConfig;
