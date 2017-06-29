interface MultiKeyStrategy<TKey> {
    getBucketKey(key: TKey): object;
    equals(lhs: TKey, rhs: TKey): boolean;
}

class ArrayKeyStrategy<T extends object> implements MultiKeyStrategy<T[]> {
    private static readonly EMPTY_BUCKET = {};

    getBucketKey(key: T[]): object {
        if (!key.length) {
            return ArrayKeyStrategy.EMPTY_BUCKET;
        }
        return key[0];
    }

    equals(lhs: T[], rhs: T[]): boolean {
        let len = lhs.length;
        if (len !== rhs.length) {
            return false;
        }
        for (let i = 0; i < len; i++) {
            if (lhs[i] !== rhs[i]) {
                return false;
            }
        }
        return true;
    }
}

interface Entry<K, V> {
    key: K;
    value: V;
}

type Bucket<K, V> = Entry<K, V>[];

/**
 * A weak map with arrays of weakly-referenced objects as key
 *
 * Performance consideration: values are bucketed into the *one element* of the respective key (by default, the first
 * array element). Inside this bucket, a linear search is performed for the correct key. This works fine as long as one
 * element of the key is already very decisive.
 *
 * A key is weakly referenced as soon as there are no entries which contain any element of that key. Again, this is only
 * practical if keys are mostly clustered.
 */
export class MultiKeyWeakMap<K, V> {
    private readonly map = new WeakMap<object, Bucket<K, V>>();

    constructor(private readonly strategy: MultiKeyStrategy<K>) {

    }

    delete(key: K): boolean {
        const result = this.find(key);
        if (!result) {
            return false;
        }
        result.bucket.splice(result.index, 1); // remove entry in-place
        return true;
    }

    get(key: K): V | undefined {
        const result = this.find(key);
        if (!result) {
            return undefined;
        }
        return result.bucket[result.index].value;
    }

    has(key: K): boolean {
        const result = this.find(key);
        return !!result;
    }

    set(key: K, value: V): this {
        const bucketKey = this.strategy.getBucketKey(key);
        let bucket = this.map.get(bucketKey);
        if (!bucket) {
            bucket = [];
            this.map.set(bucketKey, bucket);
        }
        const index = this.findIndex(bucket, key);
        if (index == undefined) {
            bucket.push({key, value});
        } else {
            bucket[index].value = value;
        }
        return this;
    }

    private find(key: K): { bucket: Bucket<K, V>, index: number } | undefined {
        const bucket = this.map.get(this.strategy.getBucketKey(key));
        if (!bucket) {
            return undefined;
        }
        const index = this.findIndex(bucket, key);
        if (index == undefined) {
            return undefined;
        }
        return {index, bucket};
    }

    private findIndex(bucket: Bucket<K, V>, key: K): number | undefined {
        const len = bucket.length;
        for (let i = 0; i < len; i++) {
            if (this.strategy.equals(bucket[i].key, key)) {
                return i;
            }
        }
        return undefined;
    }

}

export class ArrayKeyWeakMap<K, V> extends MultiKeyWeakMap<K[], V> {
    constructor() {
        super(<MultiKeyStrategy<any>>new ArrayKeyStrategy());
    }
}
