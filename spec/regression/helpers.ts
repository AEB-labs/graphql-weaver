import { execute, graphql, parse, validate } from 'graphql';
import {createProxySchema} from "../../src/proxy-schema";
import { ProxyConfig } from '../../src/config/proxy-configuration';
import { assertSuccessfulResult } from '../../src/graphql/execution-result';

/**
 * Create a graphql proxy for a configuration and execute a query on it.
 * @param proxyConfig
 * @param query
 * @param variableValues
 * @returns {Promise<void>}
 */
export async function testConfigWithQuery(proxyConfig: ProxyConfig, query: string, variableValues: {[name: string]: any}) {
    const schema = await createProxySchema(proxyConfig);
    const result = await graphql(schema, query, {cariedOnRootValue: true}, {}, variableValues, undefined);
    return assertSuccessfulResult(result);
}
