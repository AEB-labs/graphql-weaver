import { modifyPropertyAtPath, repeat, replaceArrayItem } from '../../src/utils/utils';

describe('utils', () => {
    describe('repeat', () => {
        it('repeats', () => {
            expect(repeat(true, 5)).toEqual([true, true, true, true, true]);
        });

        it('repeats zero times', () => {
            expect(repeat(true, 0)).toEqual([]);
        });

        it('returns empty array for negative values', () => {
            expect(repeat(true, -1)).toEqual([]);
        });

        it('repeats undefined', () => {
            expect(repeat(undefined, 2)).toEqual([undefined, undefined]);
        });
    });

    describe('replaceArrayItem', () => {
        it('replaces at normal index', () => {
            expect(replaceArrayItem([1,2,3], 1, 5)).toEqual([1,5,3]);
        });

        it('replaces at end', () => {
            expect(replaceArrayItem([1,2,3], 2, 5)).toEqual([1,2,5]);
        });

        it('appends', () => {
            expect(replaceArrayItem([1,2,3], 3, 5)).toEqual([1,2,3,5]);
        });

        it('inserts undefined', () => {
            expect(replaceArrayItem([1,2,3], 4, 5)).toEqual([1,2,3,undefined,5]);
        });
    });

    describe('modifyPropertyAtPath', () => {
        it('works with empty path', () => {
            expect(modifyPropertyAtPath("hello", val => val + " world", []))
                .toEqual("hello world");
        });

        it('works with simple object', () => {
            expect(modifyPropertyAtPath({ a: true, b: 123, c: 'test' }, val => val + 1, ['b']))
                .toEqual({ a: true, b: 124, c: 'test' });
        });

        it('works with simple array', () => {
            expect(modifyPropertyAtPath([1, 2, 3], val => val + 4, [1]))
                .toEqual([1,6,3]);
        });

        it('creates object if required', () => {
            expect(modifyPropertyAtPath(undefined, val => 2, ['a']))
                .toEqual({a:2});
        });

        it('creates array if required', () => {
            expect(modifyPropertyAtPath(undefined, val => 2, [1]))
                .toEqual([undefined, 2]);
        });

        it('keeps values as objects even if segment is number', () => {
            expect(modifyPropertyAtPath({0: true, 1: 123, abc: 'test'}, val => 2, [1]))
                .toEqual({0: true, 1: 2, abc: 'test'});
        });

        it('throws if non-object is given at number segment', () => {
            expect(() => modifyPropertyAtPath('Blumenkohl', val => 2, [1]))
                .toThrowError(/.*array.*string.*/);
        });

        it('throws if non-object is given at string segment', () => {
            expect(() => modifyPropertyAtPath('Blumenkohl', val => 2, ['abc']))
                .toThrowError(/.*object.*string.*/);
        });

        it('works recursively', () => {
            expect(modifyPropertyAtPath({abc: true, def: [ 1, 2, 3]}, val => 7, ['def', 4]))
                .toEqual({abc: true, def: [1,2,3, undefined, 7]})
        });
    });
});
