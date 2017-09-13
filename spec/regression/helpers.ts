import { execute, graphql, parse, validate } from 'graphql';
import {weaveSchemas} from "../../src/weave-schemas";
import { WeavingConfig } from '../../src/config/weaving-config';
import { assertSuccessfulResult } from '../../src/graphql/execution-result';

/**
 * Creates a woven schema for a configuration and executes a query on it.
 * @param proxyConfig
 * @param query
 * @param variableValues
 * @returns {Promise<void>}
 */
export async function testConfigWithQuery(proxyConfig: WeavingConfig, query: string, variableValues: {[name: string]: any}) {
    const schema = await weaveSchemas(proxyConfig);
    const result = await graphql(schema, query, {cariedOnRootValue: true}, {}, variableValues, undefined);
    return assertSuccessfulResult(result);
}
