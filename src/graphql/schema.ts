import { EndpointConfig, ProxyConfig } from '../config/proxy-configuration';
import {
    buildClientSchema, GraphQLFieldConfig, GraphQLObjectType, GraphQLSchema, GraphQLType, IntrospectionQuery,
    introspectionQuery, OperationTypeNode
} from 'graphql';
import fetch from 'node-fetch';
import { renameTypes, TypeRenamingTransformer } from './type-renamer';
import { mergeSchemas } from './schema-merger';
import { combineTransformers, transformSchema } from './schema-transformer';
import TraceError = require('trace-error');
import { createResolver } from './proxy-resolver';


export async function createSchema(config: ProxyConfig) {
    const endpoints = await Promise.all(config.endpoints.map(async endpoint => {
        return {
            name: endpoint.name,
            config: endpoint,
            schema: await fetchSchema(endpoint.url)
        };
    }));
    const endpointMap = new Map(config.endpoints.map(endpoint => <[string, EndpointConfig]>[ endpoint.name, endpoint ]));

    const renamedSchemas = endpoints.map(endpoint => ({
        schema: renameTypes(endpoint.schema, type => endpoint.name + '_' + type),
        namespace: endpoint.name,
        queryResolver: createResolver({ operation: 'query', url: endpoint.config.url}),
        mutationResolver: createResolver({ operation: 'mutation', url: endpoint.config.url}),
        subscriptionResolver: createResolver({ operation: 'subscription', url: endpoint.config.url}),
    }));
    const mergedSchema = mergeSchemas(renamedSchemas);
    //const resolvingSchema = addResolvers(mergedSchema, endpointMap);

    return mergedSchema;
}

function addResolvers(schema: GraphQLSchema, endpointMap: Map<string, EndpointConfig>) {
    return transformSchema(schema, {
        transformField(config, context) {
            const operation = getOperationIfRootType(context.oldOuterType, schema);
            if (operation) {
                const namespace = config.name;
            }
        }
    });
}

function getOperationIfRootType(type: GraphQLType, schema: GraphQLSchema): OperationTypeNode | undefined {
    if (type == schema.getQueryType()) {
        return 'query';
    }
    if (type == schema.getMutationType()) {
        return 'mutation';
    }
    if (type == schema.getSubscriptionType()) {
        return 'subscription';
    }
    return undefined;
}

async function fetchSchema(url: string) {
    let introspection = await doIntrospectionQuery(url);
    try {
        return buildClientSchema(introspection);
    } catch (error) {
        throw new TraceError(`Failed to build schema from introspection result of ${url}: ${error.message}`, error);
    }
}

async function doIntrospectionQuery(url: string): Promise<IntrospectionQuery> {
    // TODO use a graphql client lib

    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: introspectionQuery
            })
        });
    } catch (error) {
        throw new TraceError(`Error fetching introspection result from ${url}: ${error.message}`, error);
    }
    if (!res.ok) {
        throw new Error(`Error fetching introspection result from ${url}: ${res.statusText}`);
    }
    const json = await res.json<any>();
    if ('errors' in json) {
        throw new Error(`Introspection query on ${url} failed: ${JSON.stringify((<any>json).errors)}`);
    }
    return json.data;
}
