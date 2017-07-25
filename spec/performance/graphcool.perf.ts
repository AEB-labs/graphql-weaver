import { ProxyConfig } from '../../src/config/proxy-configuration';
import * as fs from 'fs';
import { BenchmarkConfig, BenchmarkFactories } from './support/async-bench';
import { query as runQuery } from '../../src/endpoints/client';

const UPSTREAM_URL = 'https://api.graph.cool/simple/v1/ciz82rakk8ina0123ioeh6od7';

const config: ProxyConfig = {
    endpoints: [
        {
            url: 'https://api.graph.cool/simple/v1/ciz82rakk8ina0123ioeh6od7',
            identifier: 'default'
        }
    ]
};

function testProcessQuery(): BenchmarkConfig {
    let queryStr: string;

    return {
        name: 'graphcool-direct',
        warmupCycles: 1,
        async fn() {
            await runQuery(UPSTREAM_URL, queryStr);
        },
        async beforeAll() {
            queryStr = fs.readFileSync('./graphcool.graphql', 'utf-8');
        }
    };
}

const benchmarks: BenchmarkFactories = [
    () => testProcessQuery()
];

export default benchmarks;