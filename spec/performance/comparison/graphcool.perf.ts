import { ProxyConfig } from '../../../src/config/proxy-configuration';
import * as fs from 'fs';
import { BenchmarkConfig } from '../support/async-bench';
import { query as runQuery } from '../../../src/endpoints/client';
import { createProxySchema } from '../../../src/proxy-schema';
import { execute, GraphQLSchema, parse } from 'graphql';
import { runComparisons } from '../support/compare-runner';

const UPSTREAM_URL = 'https://api.graph.cool/simple/v1/ciz69upbv3jgb0146dodjn9js';
const queryStr = fs.readFileSync('./graphcool.graphql', 'utf-8');

const config: ProxyConfig = {
    endpoints: [
        {
            url: UPSTREAM_URL
        }
    ]
};

function testDirect(): BenchmarkConfig {
    return {
        name: 'graphcool-direct',
        maxTime: 5,
        async fn() {
            await runQuery(UPSTREAM_URL, queryStr);
        }
    };
}

function testProxied(): BenchmarkConfig {
    let schema: GraphQLSchema;
    return {
        name: 'graphcool-proxied',
        maxTime: 5,
        async fn() {
            await execute(schema, parse(queryStr), {}, {}, {});
        },
        async beforeAll() {
            schema = await createProxySchema(config);
        }
    };
}

const benchmarks: BenchmarkConfig[] = [
    testDirect(), testProxied()
];

// to get through firewall
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

runComparisons(benchmarks);
