import {ProxyConfig} from "../config/proxy-configuration";
import {
    buildClientSchema, GraphQLNamedType, GraphQLObjectType, GraphQLSchema, GraphQLString, IntrospectionQuery,
    introspectionQuery
} from "graphql";
import fetch from "node-fetch";
import {renameTypes} from "./type-renamer";
import {mergeSchemas} from "./schema-merger";
import TraceError = require("trace-error");
import {isNativeGraphQLType} from "./native-types";


export async function createSchema(config: ProxyConfig) {
    const endpoints = await Promise.all(config.endpoints.map(async endpoint => {
        return {
            name: endpoint.name,
            config: endpoint,
            schema: await fetchSchema(endpoint.url)
        }
    }));

    const renamedSchemas = endpoints.map(endpoint => ({
        schema: renameTypes(endpoint.schema, type => endpoint.name + '_' + type),
        namespace: endpoint.name
    }));
    const mergedSchema = mergeSchemas(renamedSchemas);

    return mergedSchema;
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
        throw new Error(`Introspection query on ${url} failed: ${JSON.stringify((<any>json).errors)}`)
    }
    return json.data;
}
