import { ExecutionResult, graphql } from 'graphql';
import { weaveSchemas } from '../../src/weave-schemas';
import { WeavingConfig } from '../../src/config/weaving-config';

/**
 * Creates a woven schema for a configuration and executes a query on it.
 * @param proxyConfig
 * @param query
 * @param variableValues
 * @returns {Promise<void>}
 */
export async function testConfigWithQuery(proxyConfig: WeavingConfig, query: string, variableValues: {[name: string]: any}): Promise<ExecutionResult> {
    const schema = await weaveSchemas(proxyConfig);
    return graphql(schema, query, {cariedOnRootValue: true}, {}, variableValues, undefined);
}
