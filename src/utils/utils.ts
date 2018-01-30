import { isArray, isFunction, isNumber } from 'util';

export function objectValues<T>(obj: { [name: string]: T }): T[] {
    return Object.keys(obj).map(i => obj[i]);
}

export function objectEntries<T>(obj: { [name: string]: T }): [string, T][] {
    return Object.keys(obj).map((k): [string,T] => [k, obj[k]]);
}

export function capitalize(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function maybeDo<TIn, TOut>(input: TIn | null | undefined, fn: (input: TIn) => TOut): TOut | undefined {
    if (input == undefined) {
        return undefined;
    }
    return fn(input);
}

export function arrayToObject<TValue>(array: TValue[], keyFn: (obj: TValue) => string): { [name: string]: TValue } {
    const result: { [name: string]: TValue } = {};
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

export function mapValues<TIn, TOut>(obj: { [key: string]: TIn }, fn: (value: TIn, key: string) => TOut): { [key: string]: TOut } {
    const result: { [key: string]: TOut } = {};
    for (const key in obj) {
        result[key] = fn(obj[key], key);
    }
    return result;
}

export function filterValues<TValue>(obj: { [key: string]: TValue }, predicate: (value: TValue, key: string) => boolean): { [key: string]: TValue } {
    const result: { [key: string]: TValue } = {};
    for (const key in obj) {
        const value = obj[key];
        if (predicate(value, key)) {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Removes object properties and array values that do not match a predicate
 */
export function filterValuesDeep(obj: any, predicate: (value: any) => boolean): any {
    if (obj instanceof Array) {
        return obj
            .filter(predicate)
            .map(val => filterValuesDeep(val, predicate));
    }
    if (typeof obj === 'object' && obj !== null) {
        const filtered = filterValues(obj, predicate);
        return mapValues(filtered, val => filterValuesDeep(val, predicate));
    }
    return obj;
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

/**
 * Creates a new Map by changing the keys but leaving the values as-is
 * @param map a map
 * @param fn a function that gets an old key and returns the new key
 * @returns the new map
 */
export function mapMapValues<TKey, TValue, TNewValue>(map: Map<TKey, TValue>, fn: (value: TValue, key: TKey) => TNewValue): Map<TKey, TNewValue> {
    const newMap = new Map<TKey, TNewValue>();
    for (const [key, value] of Array.from(map)) {
        newMap.set(key, fn(value, key));
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

export function compact<T>(arr: (T | undefined | null)[]): T[] {
    return arr.filter(a => a != undefined) as T[];
}

export function mapAndCompact<TIn, TOut>(input: TIn[], fn: (input: TIn) => TOut | undefined | null): TOut[] {
    return input.map(fn).filter(a => a != undefined) as TOut[];
}

export function throwError(fn: () => Error): never
export function throwError(message: string): never
export function throwError(arg: any): never {
    if (isFunction(arg)) {
        throw arg();
    }
    throw new Error(arg);
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

export function intersect<T>(lhs: T[], rhs: T[]): T[] {
    const set = new Set(lhs);
    return rhs.filter(val => set.has(val));
}

/**
 * Binds a function, to an object, or returns undefined if the function is undefined
 * @param fn the function to bind
 * @param obj the object to bind the function to
 * @returns the bound function, or undefined
 */
export function bindNullable<T>(fn: (T & Function) | undefined, obj: any): (T & Function) | undefined {
    return fn ? fn.bind(obj) : fn;
}

/**
 * Takes an array and filters those matching a predicate into one new array, those not matching into a second
 * @param {T[]} items
 * @param {(item: T) => boolean} predicate
 * @returns {[T[] , T[]]} a tuple with the matching ones (first) and the non-matching ones (second)
 */
export function divideArrayByPredicate<T>(items: T[], predicate: (item: T) => boolean): [T[], T[]] {
    const trues = [];
    const falses = [];
    for (const def of items) {
        if (predicate(def)) {
            trues.push(def);
        } else {
            falses.push(def);
        }
    }
    return [trues, falses];
}

export function modifyPropertyAtPath(obj: any, fn: (value: any) => any, path: (string|number)[]): any {
    if (!path.length) {
        return fn(obj);
    }
    const [segment, ...rest] = path;

    // keep arrays if possible
    if (typeof segment == 'number' && segment >= 0) {
        if (obj == undefined) {
            obj = [];
        }
        if (isArray(obj)) {
            const oldItem = obj[segment];
            const newItem = modifyPropertyAtPath(oldItem, fn, rest);
            return replaceArrayItem(obj, segment, newItem);
        }
        if (typeof obj != 'object') {
            throw new TypeError(`Expected array, but got ${typeof obj} while trying to replace property path ${path}`);
        }
    }

    if (obj == undefined) {
        obj = {};
    }
    if (typeof obj != 'object') {
        throw new TypeError(`Expected object, but got ${typeof obj} while trying to replace property path ${path}`);
    }

    const val = obj[segment];
    return {
        ...obj,
        [segment]: modifyPropertyAtPath(val, fn, rest)
    };
}

export function replaceArrayItem(array: any[], index: number, newValue: any) {
    const before = array.slice(0, index /* exclusive */);
    const after = array.slice(index + 1);
    const beforeFill = repeat(undefined, index - before.length); // make sure
    return [
        ...before,
        ...beforeFill,
        newValue,
        ...after
    ];
}

export function repeat(value: any, count: number) {
    if (count <= 0) {
        return [];
    }
    const arr = new Array(count);
    for (let i = 0; i < count; i++) {
        arr[i] = value;
    }
    return arr;
}

export function getOrSetFromMap<K, V>(map: Map<K, V>, key: K, defaultFn: () => V): V {
    if (map.has(key)) {
        return map.get(key)!;
    }
    const value = defaultFn();
    map.set(key, value);
    return value;
}

export function isPromise<T>(value: any): value is Promise<T> {
    return typeof value === 'object' && value !== null && typeof value.then === 'function';
}
