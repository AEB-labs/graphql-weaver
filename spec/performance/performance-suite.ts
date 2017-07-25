import GRAPHCOOL from './graphcool.perf';
import { runBenchmarks } from './support/runner';

const benchmarks = [
    ...GRAPHCOOL
];

// to get through firewall
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

runBenchmarks(benchmarks);
