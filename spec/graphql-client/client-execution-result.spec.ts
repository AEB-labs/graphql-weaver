import {
    ClientExecutionResult, convertFormattedErrorsToErrors
} from '../../src/graphql-client/client-execution-result';
import { GraphQLError } from 'graphql';

describe('convertFormattedErrorsToErrors', () => {
    const error = new GraphQLError('this is a test');
    const input: ClientExecutionResult = {
        errors: [
            {
                message: 'a test message',
                locations: [
                    {
                        line: 5,
                        column: 3
                    }
                ],
                path: ['a', 'b']
            },
            error,
            new Error(`normal error`)
        ]
    };

    it('converts simple objects to GraphQLError instances', () => {
        const result = convertFormattedErrorsToErrors(input);
        expect(result.errors![0] instanceof GraphQLError).toBeTruthy();
    });

    it('resets locations', () => {
        // see comment in convertFormattedErrorsToErrors - these locations are likely to be wrong
        const result = convertFormattedErrorsToErrors(input);
        expect(result.errors![0].locations).toBe(undefined);
    });

    it('carries paths over', () => {
        const result = convertFormattedErrorsToErrors(input);
        expect(result.errors![0].path![0]).toEqual('a')
    });

    it('leaves GraphQLError instances as-is', () => {
        const result = convertFormattedErrorsToErrors(input);
        expect(result.errors![1]).toBe(error);
    });

    it('converts normal errors to GraphQLError instances', () => {
        const result = convertFormattedErrorsToErrors(input);
        expect(result.errors![2] instanceof GraphQLError).toBeTruthy();
    });
});
