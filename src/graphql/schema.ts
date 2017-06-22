import { LinkConfigMap, ProxyConfig } from '../config/proxy-configuration';
import { GraphQLFieldResolver, OperationTypeNode, parse } from 'graphql';
import { renameTypes } from './type-renamer';
import { mergeSchemas, NamedSchema } from './schema-merger';
import { combineTransformers, transformSchema } from './schema-transformer';
import { getReverseTypeRenamer, getTypePrefix } from './renaming';
import { SchemaLinkTransformer } from './links';
import { resolveAsProxy } from './proxy-resolver';
import { TypeResolversTransformer } from './type-resolvers';
import { DefaultEndpointFactory } from '../endpoints/endpoint-factory';
import { DefaultResolversTransformer } from './default-resolvers';
import {
    EMPTY_INTROSPECTION_QUERY,
    EXTENDED_INTROSPECTION_QUERY, ExtendedIntrospectionQuery, supportsExtendedIntrospection
} from '../endpoints/extended-introspection';
import TraceError = require('trace-error');

// Not decided on an API to choose this, so leave non-configurable for now
const endpointFactory = new DefaultEndpointFactory();

export async function createProxySchema(config: ProxyConfig) {
    const endpoints = await Promise.all(config.endpoints.map(async config => {
        const endpoint = endpointFactory.getEndpoint(config);
        const schema = await endpoint.getSchema();
        const extendedIntrospection = supportsExtendedIntrospection(schema) ?
            await endpoint.query(parse(EXTENDED_INTROSPECTION_QUERY)) : EMPTY_INTROSPECTION_QUERY;
        return {
            name: config.name,
            config,
            endpoint,
            schema,
            extendedIntrospection
        };
    }));

    const renamedLinkMap: LinkConfigMap = {};
    for (const endpoint of endpoints) {
        // copy the links from tne introspection schema into the config
        // This is pretty ugly as it modifies the config object. It would probably be better to have a separate step
        // to consolidate the provided JSON with all the introspection information
        for (const type of endpoint.extendedIntrospection._extIntrospection.types) {
            for (const field of type.fields) {
                if (field.link) {
                    endpoint.config.links[type.name + "." + field.name] = field.link;
                }
            }
        }

        for (const linkName in endpoint.config.links) {
            renamedLinkMap[getTypePrefix(endpoint.config) + linkName] = endpoint.config.links[linkName];
        }
    }

    const renamedSchemas = endpoints.map((endpoint): NamedSchema => {
        const prefix = getTypePrefix(endpoint.config);
        const typeRenamer = (type: string) => prefix + type;
        const reverseTypeRenamer = getReverseTypeRenamer(endpoint.config);
        const baseResolverConfig = {
            query: endpoint.endpoint.query.bind(endpoint.endpoint),
            typeRenamer: reverseTypeRenamer,
            links: renamedLinkMap
        };

        function createResolver(operation: OperationTypeNode): GraphQLFieldResolver<any, any> {
            return (source, args, context, info) => resolveAsProxy(info, {...baseResolverConfig, operation}, context);
        }

        return {
            schema: renameTypes(endpoint.schema, typeRenamer),
            namespace: endpoint.name,
            queryResolver: createResolver('query'),
            mutationResolver: createResolver('mutation'),
            subscriptionResolver: createResolver('subscription')
        };
    });
    const mergedSchema = mergeSchemas(renamedSchemas);
    return transformSchema(mergedSchema, combineTransformers(
        new SchemaLinkTransformer({
            endpoints: endpoints.map(e => e.config),
            schema: mergedSchema,
            links: renamedLinkMap,
            endpointFactory
        }),
        new TypeResolversTransformer(endpoints.map(e => e.config)),
        new DefaultResolversTransformer()
    ));
}
