import { defaultTestSchema } from '../../helpers/grapqhl-http-test/graphql-http-test-schema';
import { parse } from 'graphql';
import * as fs from 'fs';
import { BenchmarkConfig, BenchmarkFactories } from '../support/async-bench';
import { Pipeline } from '../../../src/pipeline/pipeline';
import { WeavingConfig } from '../../../src/config/weaving-config';
import { createPipeline } from '../../../src/weave-schemas';
import * as path from 'path';

const config: WeavingConfig = {
    endpoints: [
        {
            schema: defaultTestSchema,
            identifier: 'default'
        }
    ]
};

function testProcessQuery(): BenchmarkConfig {
    const queryStr = fs.readFileSync(path.resolve(__dirname, 'query.graphql'), 'utf-8');
    let pipeline: Pipeline|undefined;

    return {
        name: 'processQuery',
        warmupCycles: 100,
        async fn() {
            pipeline!.processQuery({
                document: parse(queryStr),
                variableValues: {}
            }, 'default');
        },
        async beforeAll() {
            pipeline = await createPipeline(config, { consumeError: (error) => { throw error } });
            pipeline.schema; // build schema
        }
    };
}

export const QUERY_BENCHMARKS: BenchmarkFactories = [
    () => testProcessQuery()
];
