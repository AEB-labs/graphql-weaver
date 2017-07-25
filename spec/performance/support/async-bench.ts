// asynchronous benchmarks

const TARGET_RELATIVE_MARGIN_OF_ERROR = 0.02;
const DEFAULT_MAX_TIME = 30;
const INITIAL_ITERATION_COUNT = 1;
const TARGET_CYCLE_TIME = DEFAULT_MAX_TIME / 10;
const INCLUDE_INITIAL_SETUP_IN_MAX_TIME = false; // makes million-docs-tests feasable

export interface BenchmarkConfig {
    readonly name: string;
    readonly fn: () => Promise<any>;
    readonly before?: (info: {count: number}) => Promise<any>;
    readonly beforeAll?: () => Promise<any>;
    readonly maxTime?: number;
}

export type BenchmarkFactories = Array<() => BenchmarkConfig>;

interface Timings {
    readonly sampleCount: number;
    readonly meanTime: number;
    readonly relativeMarginOfError: number;
}

interface BenchmarkState {
    readonly timings: Timings;
    readonly cycles: number;
    readonly iterationCount: number;
    readonly elapsedTime: number;
    readonly elapsedNetTime: number;
    readonly elapsedTimeForInitialSetUp: number;
    readonly config: BenchmarkConfig;
}

interface BenchmarkAction {
    readonly shouldContinue: boolean;
    readonly nextIterationCount?: number;
}

export class BenchmarkCycleDetails {
    /**
     * The zero-based index of this cycyle
     */
    public readonly index: number;

    /**
     * The number of iterations executed in this cycle
     */
    public readonly iterationCount: number;

    /**
     * The total time spent so far
     */
    public readonly elapsedTime: number;

    /**
     * The time, in seconds, spent on non-iteration tasks so far
     */
    public readonly setUpTime: number;

    /**
     * The statistics collected up to this point
     */
    public readonly timingsSoFar: Timings;

    constructor(config: {index: number, iterationCount: number, elapsedTime: number, setUpTime: number, timingsSoFar: Timings}) {
        this.index = config.index;
        this.iterationCount = config.iterationCount;
        this.elapsedTime = config.elapsedTime;
        this.setUpTime = config.setUpTime;
        this.timingsSoFar = config.timingsSoFar;
    }
}

interface BenchmarkResultConfig {
    readonly cycles: number;
    readonly iterationCount: number;
    readonly meanTime: number;
    readonly relativeMarginOfError: number;

    readonly elapsedTime: number;
    readonly setUpTime: number;
    readonly cycleDetails: BenchmarkCycleDetails[];
}

export class BenchmarkResult {
    /**
     * The number of cycles
     */
    public readonly cycles: number;

    /**
     * Detailed information about each cycle
     */
    public readonly cycleDetails: BenchmarkCycleDetails[];

    /**
     * The mean time, in seconds, per iteration
     */
    public readonly meanTime: number;

    /**
     * The relative margin of error of the meanTime
     */
    public readonly relativeMarginOfError: number;

    /**
     * The total time, in seconds, the whole benchmark took
     */
    public readonly elapsedTime: number;

    /**
     * The total time spent on non-iteration tasks
     */
    public readonly setUpTime: number;

    /**
     * The total number of iterations
     */
    public readonly iterationCount: number;

    constructor(config: BenchmarkResultConfig) {
        this.cycles = config.cycles;
        this.meanTime = config.meanTime;
        this.relativeMarginOfError = config.relativeMarginOfError;
        this.elapsedTime = config.elapsedTime;
        this.setUpTime = config.setUpTime;
        this.cycleDetails = config.cycleDetails;
        this.iterationCount = config.iterationCount;
    }

    toString() {
        return `${(this.meanTime * 1000).toFixed(3)} ms per iteration (±${(this.relativeMarginOfError * 100).toFixed(2)}%)`;
    }
}

export interface BenchmarkExecutionCallbacks {
    readonly onCycleDone?: (cycleDetails: BenchmarkCycleDetails) => void;
}

const stats = require("stats-lite");

export async function benchmark(config: BenchmarkConfig, callbacks?: BenchmarkExecutionCallbacks): Promise<BenchmarkResult> {
    async function cycle(count: number): Promise<number[]> {
        if (config.before) {
            await config.before({count});
        }

        const timeBefore = time();
        for (let i = 0; i < count; i++) {
            await config.fn();
        }
        const timeAfter = time();

        return [ timeAfter - timeBefore ];
    }

    async function cycleDetailed(count: number): Promise<number[]> {
        if (config.before) {
            await config.before({count});
        }
        const times = Array(count);
        for (let i = 0; i < count; i++) {
            const timeBefore = time();
            await config.fn();
            const timeAfter = time();
            times[i] = timeAfter - timeBefore;
        }

        return times;
    }

    const startTime = time();
    if (config.beforeAll) {
        await config.beforeAll();
    }
    const elapsedTimeForInitialSetUp = time() - startTime;

    const times: number[] = [];
    const cycleDetails: BenchmarkCycleDetails[] = [];
    let state: BenchmarkState = {
        elapsedTime: 0,
        elapsedNetTime: 0,
        elapsedTimeForInitialSetUp,
        cycles: 0,
        iterationCount: 0,
        config: config,
        timings: getTimings(times)
    };

    while (true) {
        // Preparation
        const iterationCount = nextIterationCount(state);
        const cycleFn = iterationCount > 10000 ? cycle : cycleDetailed;
        if (!iterationCount) {
            break;
        }

        // Run cycle
        const netTimes = await cycleFn(iterationCount);

        // Calculate next state
        const netTime = stats.sum(netTimes);
        times.push(...netTimes);
        state = {
            timings: getTimings(times),
            config: state.config,
            cycles: state.cycles + 1,
            iterationCount: state.iterationCount + iterationCount,
            elapsedTime: time() - startTime,
            elapsedNetTime: state.elapsedNetTime + netTime,
            elapsedTimeForInitialSetUp: state.elapsedTimeForInitialSetUp
        };

        // Report status
        cycleDetails.push(new BenchmarkCycleDetails({
            index: state.cycles - 1,
            elapsedTime: state.elapsedTime,
            setUpTime: state.elapsedTime - state.elapsedNetTime,
            iterationCount,
            timingsSoFar: state.timings
        }));

        if (callbacks && callbacks.onCycleDone) {
            callbacks.onCycleDone(cycleDetails[cycleDetails.length - 1]);
        }
    }
    return new BenchmarkResult({
        meanTime: state.timings.meanTime,
        relativeMarginOfError: state.timings.relativeMarginOfError,
        cycles: cycleDetails.length,
        iterationCount: state.iterationCount,
        elapsedTime: state.elapsedTime,
        setUpTime: state.elapsedTime - state.elapsedNetTime,
        cycleDetails
    });
}

function nextIterationCount(state: BenchmarkState): number {
    const maxTime = state.config.maxTime || DEFAULT_MAX_TIME;
    let remainingTime = maxTime - state.elapsedTime;
    if (!INCLUDE_INITIAL_SETUP_IN_MAX_TIME) {
        // this time is included in elapsedTime, so give it back
        remainingTime += state.elapsedTimeForInitialSetUp;
    }

    // Always do at least one cycle
    if (state.cycles == 0) {
        return INITIAL_ITERATION_COUNT;
    }

    // Already out of time?
    if (remainingTime <= 0) {
        return 0;
    }

    // We're accurate enough
    if (state.timings.relativeMarginOfError < TARGET_RELATIVE_MARGIN_OF_ERROR) {
        return 0;
    }

    // be very careful, but do not abort test just because we have no confidence
    const errorFactor = Math.min(state.timings.relativeMarginOfError + 1, 10);

    // Do we still have time for setup?
    const meanSetUpTime = (state.elapsedTime - state.elapsedNetTime - state.elapsedTimeForInitialSetUp) / state.cycles;
    if (remainingTime < meanSetUpTime) {
        return 0;
    }

    // try to get to the target cycle time
    const remainingNetTime = remainingTime - meanSetUpTime;
    // we don't include the errorFactor in meanTime because it does not matter if a iteration is too long as long as we
    // don't overshoot the remaining time
    const remainingNetTimeWithSafetyMargin = remainingNetTime / errorFactor;
    const targetNetTime = Math.min(remainingNetTimeWithSafetyMargin, TARGET_CYCLE_TIME);
    return Math.round(targetNetTime / state.timings.meanTime);
}

export function time() {
    const hrTime = process.hrtime();
    return hrTime[0] + hrTime[1] / 1000000000;
}

/**
 * T-Distribution two-tailed critical values for 95% confidence.
 * For more info see http://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm.
 */
const tTable: {[key: string]: number} = {
    '1': 12.706, '2': 4.303, '3': 3.182, '4': 2.776, '5': 2.571, '6': 2.447,
    '7': 2.365, '8': 2.306, '9': 2.262, '10': 2.228, '11': 2.201, '12': 2.179,
    '13': 2.16, '14': 2.145, '15': 2.131, '16': 2.12, '17': 2.11, '18': 2.101,
    '19': 2.093, '20': 2.086, '21': 2.08, '22': 2.074, '23': 2.069, '24': 2.064,
    '25': 2.06, '26': 2.056, '27': 2.052, '28': 2.048, '29': 2.045, '30': 2.042,
    'infinity': 1.96
};

function getTimings(times: number[]): Timings {
    const mean: number = stats.mean(times);
    // Compute the sample standard deviation (estimate of the population standard deviation).
    const sd = stats.stdev(times);
    // Compute the standard error of the mean (a.k.a. the standard deviation of the sampling distribution of the sample mean).
    const sem = sd / Math.sqrt(times.length);
    // Compute the degrees of freedom.
    const df = times.length - 1;
    // Compute the critical value.
    const critical = tTable[Math.round(df) || 1] || tTable['infinity'];
    // Compute the margin of error.
    const moe = sem * critical;
    // Compute the relative margin of error.
    const rme = (moe / mean) || Infinity;

    return {
        relativeMarginOfError: rme,
        meanTime: mean,
        sampleCount: times.length
    }
}
