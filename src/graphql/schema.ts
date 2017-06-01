import { LinkConfigMap, ProxyConfig } from '../config/proxy-configuration';
import { buildClientSchema, IntrospectionQuery, introspectionQuery } from 'graphql';
import fetch from 'node-fetch';
import { renameTypes } from './type-renamer';
import { mergeSchemas } from './schema-merger';
import { transformSchema } from './schema-transformer';
import { createResolver } from './proxy-resolver';
import { getReverseTypeRenamer, getTypePrefix } from './renaming';
import { SchemaLinkTransformer } from './links';
import TraceError = require('trace-error');

export async function createSchema(config: ProxyConfig) {
    const endpoints = await Promise.all(config.endpoints.map(async endpoint => {
        return {
            name: endpoint.name,
            config: endpoint,
            schema: await fetchSchema(endpoint.url)
        };
    }));

    const renamedLinkMap: LinkConfigMap = {};
    for (const endpoint of endpoints) {
        for (const linkName in endpoint.config.links) {
            renamedLinkMap[getTypePrefix(endpoint.config) + linkName] = endpoint.config.links[linkName];
        }
    }

    const renamedSchemas = endpoints.map(endpoint => {
        const prefix = getTypePrefix(endpoint.config);
        const typeRenamer = (type: string) => prefix + type;
        const reverseTypeRenamer = getReverseTypeRenamer(endpoint.config);
        const baseResolverConfig = {
            url: endpoint.config.url,
            typeRenamer: reverseTypeRenamer,
            links: renamedLinkMap
        };
        return {
            schema: renameTypes(endpoint.schema, typeRenamer),
            namespace: endpoint.name,
            queryResolver: createResolver({...baseResolverConfig, operation: 'query'}),
            mutationResolver: createResolver({...baseResolverConfig, operation: 'mutation'}),
            subscriptionResolver: createResolver({...baseResolverConfig, operation: 'subscription'})
        };
    });
    const mergedSchema = mergeSchemas(renamedSchemas);
    const linkedSchema = transformSchema(mergedSchema, new SchemaLinkTransformer(endpoints.map(e => e.config), mergedSchema, renamedLinkMap));

    return linkedSchema;
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
