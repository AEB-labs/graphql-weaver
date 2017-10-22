import { runBenchmarks } from './support/runner';
import { BenchmarkConfig, BenchmarkFactories } from './support/async-bench';
import { QUERY_BENCHMARKS } from './profiling/query-pipeline.perf';
import { COMPARISON } from './comparison/comparison';
import { runComparisons } from './support/compare-runner';

console.log('Make sure graphql-weaver-test-schema is running');

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