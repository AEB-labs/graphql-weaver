export function objectValues(obj: {[name: string]: any}): any[] {
    return Object.keys(obj).map(i => obj[i]);
}

export function objectEntries(obj: {[name: string]: any}): any[] {
    return Object.keys(obj).map(k => [k, obj[k]]);
}

export function capitalize(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function maybeDo<TIn, TOut>(input: TIn|null|undefined, fn: (input: TIn) => TOut): TOut|undefined {
    if (input == undefined) {
        return undefined;
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

export function objectFromKeys<TValue>(keys: string[], valueFn: (obj: string) => TValue): {[name: string]: TValue} {
    const result: {[name: string]: TValue} = {};
    for (const key of keys) {
        result[key] = valueFn(key);
    }
    return result;
}

export function objectFromKeyValuePairs<TValue>(pairs: [string, TValue][]): {[name: string]: TValue} {
    const result: {[name: string]: TValue} = {};
    for (const [key, value] of pairs) {
        result[key] = value;
    }
    return result;
}

export function objectToMap<T>(object: {[name: string]: T}): Map<string, T> {
    return new Map<string, T>(objectEntries(object));
}

export function mapValues<TIn, TOut>(obj: {[key: string]: TIn}, fn: (value: TIn, key: string) => TOut): {[key: string]: TOut} {
    const result: {[key: string]: TOut} = {};
    for (const key in obj) {
        result[key] = fn(obj[key], key);
    }
    return result;
}

/**
 * Creates a new Map by changing the keys but leaving the values as-is
 * @param map a map
 * @param fn a function that gets an old key and returns the new key
 * @returns the new map
 */
export function mapMapKeys<TKey, TNewKey, TValue>(map: Map<TKey, TValue>, fn: (key: TKey) => TNewKey): Map<TNewKey, TValue> {
    const newMap = new Map<TNewKey, TValue>();
    for (const [key, value] of Array.from(map)) {
        newMap.set(fn(key), value);
    }
    return newMap;
}

export function flatten<T>(input: T[][]): T[] {
    const arr: T[] = [];
    return arr.concat(...input);
}

export function flatMap<TIn, TOut>(input: TIn[], fn: (input: TIn) => TOut[]): TOut[] {
    return flatten(input.map(fn));
}

export function compact<T>(arr: (T|undefined|null)[]): T[] {
    return arr.filter(a => a != undefined) as T[];
}

export function mapAndCompact<TIn, TOut>(input: TIn[], fn: (input: TIn) => TOut|undefined|null): TOut[] {
    return input.map(fn).filter(a => a != undefined) as TOut[];
}

export function throwError(message: string): never {
    throw new Error(message);
}

export function groupBy<TItem, TKey>(arr: TItem[], keyFn: (key: TItem) => TKey): Map<TKey, TItem[]> {
    const map = new Map<TKey, TItem[]>();
    for (const item of arr) {
        const key = keyFn(item);
        let bucket = map.get(key);
        if (!bucket) {
            bucket = [];
            map.set(key, bucket);
        }
        bucket.push(item);
    }
    return map;
}
