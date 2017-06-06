import { LinkConfigMap, ProxyConfig } from '../config/proxy-configuration';
import { GraphQLFieldResolver, OperationTypeNode } from 'graphql';
import { renameTypes } from './type-renamer';
import { mergeSchemas, NamedSchema } from './schema-merger';
import { combineTransformers, transformSchema } from './schema-transformer';
import { getReverseTypeRenamer, getTypePrefix } from './renaming';
import { SchemaLinkTransformer } from './links';
import { resolveAsProxy } from './proxy-resolver';
import { TypeResolversTransformer } from './type-resolvers';
import { EndpointFactory } from '../endpoints/endpoint-factory';
import TraceError = require('trace-error');

export async function createProxySchema(config: ProxyConfig, endpointFactory: EndpointFactory) {
    const endpoints = await Promise.all(config.endpoints.map(async config => {
        const endpoint = endpointFactory.getEndpoint(config);
        return {
            name: config.name,
            config,
            endpoint,
            schema: await endpoint.getSchema()
        };
    }));

    const renamedLinkMap: LinkConfigMap = {};
    for (const endpoint of endpoints) {
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
            return (source, args, context, info) => resolveAsProxy(info, {...baseResolverConfig, operation});
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
        new TypeResolversTransformer()
    ));
}
