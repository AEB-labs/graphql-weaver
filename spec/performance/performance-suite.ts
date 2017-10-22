import { runBenchmarks } from './support/runner';
import { BenchmarkConfig, BenchmarkFactories } from './support/async-bench';
import { QUERY_BENCHMARKS } from './profiling/query-pipeline.perf';
import { COMPARISON } from './comparison/comparison';
import { runComparisons } from './support/compare-runner';
import { GraphQLHTTPTestEndpoint } from '../helpers/grapqhl-http-test/graphql-http-test-endpoint';

new GraphQLHTTPTestEndpoint().start(1337);

const benchmarks: BenchmarkFactories = [
    ...QUERY_BENCHMARKS
];

const comparisons: BenchmarkConfig[][] = [
    //COMPARISON
];

async function run() {
    await runBenchmarks(benchmarks);

    for (const comparison of comparisons) {
        await runComparisons(comparison);
    }
}
run();