import { execute, parse, validate } from 'graphql';
import {createProxySchema} from "../../src/proxy-schema";
import { assertSuccessfulResponse } from '../../src/endpoints/client';
import { ProxyConfig } from '../../src/config/proxy-configuration';

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
    const errors = validate(schema, document);
    if (errors.length) {
        throw new Error(JSON.stringify(errors));
    }
    const result = await execute(schema, document, {cariedOnRootValue: true}, {}, variableValues, undefined);
    assertSuccessfulResponse(result);
    return result.data;
}
