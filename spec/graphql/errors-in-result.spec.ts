import { GraphQLError } from 'graphql';
import { FieldErrorValue, moveErrorsToData } from '../../src/graphql/errors-in-result';

describe('moveErrorsIntoResult', () => {
    it('moves error of direct field', () => {
        const error = new GraphQLError('message', undefined, undefined, undefined, [ 'erroneous' ]);
        const result = moveErrorsToData({
            data: { abc: true, erroneous: 'test' },
            errors: [ error ]
        });
        expect(result.errors).toBeUndefined();
        expect(result.data!.abc).toBe(true);
        expect(result.data!.erroneous.constructor).toBe(FieldErrorValue);
        expect(result.data!.erroneous.originalValue).toBe('test');
        expect(result.data!.erroneous.errors).toEqual([error]);
    });

    it('works with two errors on the same field', () => {
        const error1 = new GraphQLError('message', undefined, undefined, undefined, [ 'erroneous' ]);
        const error2 = new GraphQLError('message 2', undefined, undefined, undefined, [ 'erroneous' ]);
        const result = moveErrorsToData({
            data: { abc: true, erroneous: 'test' },
            errors: [ error1, error2 ]
        });
        expect(result.errors).toBeUndefined();
        expect(result.data!.erroneous.constructor).toBe(FieldErrorValue);
        expect(result.data!.erroneous.originalValue).toBe('test');
        expect(result.data!.erroneous.errors).toEqual([error1, error2 ]);
    });

    it('moves error of nested field', () => {
        const error = new GraphQLError('message', undefined, undefined, undefined, [ 'wrap', 'erroneous' ]);
        const result = moveErrorsToData({
            data: { abc: true, wrap: { erroneous: 'test', working: 'abc' } },
            errors: [ error ]
        });
        expect(result.errors).toBeUndefined();
        expect(result.data!.wrap.working).toBe('abc');
        expect(result.data!.wrap.erroneous.constructor.name).toBe(FieldErrorValue.name);
        expect(result.data!.wrap.erroneous.originalValue).toBe('test');
        expect(result.data!.wrap.erroneous.errors).toEqual([error]);
    });

    it('moves error of array item field', () => {
        const error = new GraphQLError('message', undefined, undefined, undefined, [ 'array', 2 ]);
        const result = moveErrorsToData({
            data: { abc: true, array: [ 1, 2, 3] },
            errors: [ error ]
        });
        expect(result.errors).toBeUndefined();
        expect(result.data!.array[0]).toBe(1);
        expect(result.data!.array[2].constructor.name).toBe(FieldErrorValue.name);
        expect(result.data!.array[2].originalValue).toBe(3);
        expect(result.data!.array[2].errors).toEqual([error]);
    });

    it('creates data property if missing', () => {
        const error = new GraphQLError('message', undefined, undefined, undefined, [ 'abc' ]);
        const result = moveErrorsToData({
            data: { abc: true },
            errors: [ error ]
        });
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe('object');
        expect(result.data!.abc.constructor.name).toBe(FieldErrorValue.name);
    });

    it('creates field skeleton for null values', () => {
        const error = new GraphQLError('message', undefined, undefined, undefined, [ 'wrap', 'erroneous' ]);
        const result = moveErrorsToData({
            data: { abc: true },
            errors: [ error ]
        });
        expect(result.errors).toBeUndefined();
        expect(typeof result.data!.wrap).toBe('object');
        expect(result.data!.wrap.erroneous.constructor.name).toBe(FieldErrorValue.name);
        expect(result.data!.wrap.erroneous.originalValue).toBe(undefined);
        expect(result.data!.wrap.erroneous.errors).toEqual([error]);
    });

    it('leaves global errors', () => {
        const error = new GraphQLError('global message');
        const result = moveErrorsToData({
            data: { abc: true },
            errors: [ error ]
        });
        expect(result).toEqual({ data: { abc: true }, errors: [ error ]});
    });
});
