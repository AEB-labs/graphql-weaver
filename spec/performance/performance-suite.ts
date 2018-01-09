import { runBenchmarks } from './support/runner';
import { BenchmarkConfig, BenchmarkFactories } from './support/async-bench';
import { QUERY_BENCHMARKS } from './profiling/query-pipeline.perf';
import { COMPARISON } from './comparison/comparison';
import { runComparisons } from './support/compare-runner';
import { GraphQLHTTPTestEndpoint } from '../helpers/grapqhl-http-test/graphql-http-test-endpoint';
import { JOIN_BENCHMARKS } from './profiling/join';

const benchmarks: BenchmarkFactories = [
    ...QUERY_BENCHMARKS,
    ...JOIN_BENCHMARKS
];

const comparisons: BenchmarkConfig[][] = [
    COMPARISON
];

async function run() {
    const testSever = new GraphQLHTTPTestEndpoint();
    testSever.start(1337);

    await runBenchmarks(benchmarks);

    for (const comparison of comparisons) {
        await runComparisons(comparison);
    }

    testSever.stop();
}
run();
