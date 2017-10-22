import { BenchmarkConfig, time } from './async-bench';
import { runComparison } from './compare';

const colors = require('colors');
colors.enabled = true;

const SHOW_CYCLE_INFO = false;

function formatMs(seconds: number) {
    return `${(seconds * 1000).toFixed(3)}ms`;
}

function formatPercent(fraction: number) {
    return `${(fraction * 100).toFixed(2)}%`;
}

function formatTimings({meanTime, relativeMarginOfError}: { meanTime: number, relativeMarginOfError: number }) {
    return `${formatMs(meanTime)} (±${formatPercent(relativeMarginOfError)}%)`;
}

function formatElapsedTime({elapsedTime, setUpTime}: { elapsedTime: number, setUpTime: number }) {
    return `${elapsedTime.toFixed()}s elapsed (${(setUpTime / elapsedTime * 100).toFixed()}% for setup)`;
}

function formatOverhead(x: {overheadMin: number, relativeOverheadMin: number, overheadMax: number, relativeOverheadMax: number }) {
    return `${formatMs(x.overheadMin)} \u2013 ${formatMs(x.overheadMax)} (${formatPercent(x.relativeOverheadMin)} \u2013 ${formatPercent(x.relativeOverheadMax)})`;
}

interface BenchmarkSuiteResult {
    hasErrors: boolean;
}

async function runAsync(benchmarks: BenchmarkConfig[]): Promise<BenchmarkSuiteResult> {
    const startTime = time();
    console.log('');
    console.log('Running comparison suite');
    let index = 1;
    let erroredCount = 0;

    const result = await runComparison(benchmarks, {
        onCycleDone: cycle => {
            if (SHOW_CYCLE_INFO) {
                console.log((`  Cycle ${cycle.index + 1} of ${cycle.name}: ${cycle.iterationCount} iterations, ` +
                    `current estimate: ${formatTimings(cycle.timingsSoFar)} per iteration, ` +
                    `${formatElapsedTime(cycle)}`).grey);
            }
        }
    });

    for (const candidate of result.candidates) {
        console.log('');
        console.log(`[${index} / ${benchmarks.length}] ${candidate.config.name}...`.yellow.bold);
        console.log(`  ${formatTimings(candidate.benchmark)}`.green + ` per iteration`);
        console.log(`  ${formatElapsedTime(candidate.benchmark)} for ${candidate.benchmark.iterationCount} iterations in ${candidate.benchmark.cycles} cycles`);
        if (candidate.isFastest) {
            console.log(`  Fastest result.`.green.bgBlack)
        } else  {
            console.log(`  Slower than fastest by ${formatOverhead(candidate)}`.yellow.bgBlack)
        }
        index++;
    }

    const elapsed = time() - startTime;
    const elapsedMinutes = Math.floor(elapsed / 60);
    const elapsedSeconds = Math.floor(elapsed % 60);
    console.log('');
    console.log(`Done.`.bold);
    console.log(`Executed ${benchmarks.length} benchmarks in ${elapsedMinutes} minutes, ${elapsedSeconds} seconds`.bold);
    if (erroredCount) {
        console.log(`${erroredCount} benchmarks reported an error.`.red.bold);
    }
    console.log('');
    return {
        hasErrors: erroredCount > 0
    };
}

export function runComparisons(benchmarks: BenchmarkConfig[]) {
    return runAsync(benchmarks)
        .then((result) => {
            if (result.hasErrors && !process.exitCode) {
                process.exitCode = 1;
            }
        })
        .catch(err => {
            console.log(err.message, err.stack);
            if (!process.exitCode) {
                process.exitCode = 1;
            }
        });
}