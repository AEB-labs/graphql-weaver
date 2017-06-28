import {execute, parse} from "graphql";
import {ProxyConfig} from "../../src/config/proxy-configuration";
import {createProxySchema} from "../../src/graphql/schema";

/**
 * Create a graphql proxy for a configuration and execute a query on it.
 * @param proxyConfig
 * @param query
 * @param variableValues
 * @returns {Promise<void>}
 */
export async function testConfigWithQuery(proxyConfig: ProxyConfig, query: string, variableValues: {[name: string]: any}) {
    const schema = await createProxySchema(proxyConfig);
    const document = parse(query, {});
    const result = await execute(schema.schema, document, {}, {}, variableValues, undefined);
    return result.data;
}
