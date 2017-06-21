export function objectValues(obj: {[name: string]: any}): any[] {
    return Object.keys(obj).map(i => obj[i]);
}

export function capitalize(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function maybeDo<TIn, TOut>(input: TIn|undefined, fn: (input: TIn) => TOut): TOut|undefined {
    if (!input) {
        return input;
    }
    return fn(input);
}

export function arrayToObject<TValue>(array: TValue[], keyFn: (obj: TValue) => string): {[name: string]: TValue} {
    const result: {[name: string]: TValue} = {};
    for (const item of array) {
        result[keyFn(item)] = item;
    }
    return result;
}

export function mapValues<TIn, TOut>(obj: {[key: string]: TIn}, fn: (input: TIn) => TOut): {[key: string]: TOut} {
    const result: {[key: string]: TOut} = {};
    for (const key in obj) {
        result[key] = fn(obj[key]);
    }
    return result;
}
