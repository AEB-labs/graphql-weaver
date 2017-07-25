import { defaultTestSchema } from '../../helpers/grapqhl-http-test/graphql-http-test-schema';
import { ProxyConfig } from '../../../src/config/proxy-configuration';
import { createPipeline } from '../../../src/proxy-schema';
import { parse } from 'graphql';
import * as fs from 'fs';
import { BenchmarkConfig, BenchmarkFactories } from '../support/async-bench';
import { Pipeline } from '../../../src/pipeline/pipeline';
import { runBenchmarks } from '../support/runner';

const config: ProxyConfig = {
    endpoints: [
        {
            schema: defaultTestSchema,
            identifier: 'default'
        }
    ]
};

function testProcessQuery(): BenchmarkConfig {
    let pipeline: Pipeline;
    let queryStr: string;

    return {
        name: 'processQuery',
        warmupCycles: 100,
        async fn() {
            pipeline.processQuery({
                document: parse(queryStr),
                variableValues: {}
            }, 'default');
        },
        async beforeAll() {
            queryStr = fs.readFileSync('./query.graphql', 'utf-8');
            pipeline = await createPipeline(config);
        }
    };
}

const benchmarks: BenchmarkFactories = [
    () => testProcessQuery()
];

runBenchmarks(benchmarks);
