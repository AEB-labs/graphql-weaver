import { isNumber } from "util";
import { GraphQLScalarType } from 'graphql';

export const NonNegativeInt = new GraphQLScalarType({
    name: 'NonNegativeInt',
    parseValue(value) {
        if (!isNumber(value) || !isFinite(value) || value < 0) {
            throw new TypeError('Not a non-negative integer: ' + value);
        }
        return value;
    },
    serialize(value) {
        return parseInt(value);
    },
    parseLiteral(valueNode) {
        if (valueNode.kind == 'IntValue' && parseInt(valueNode.value) >= 0) {
            return parseInt(valueNode.value);
        }
        return undefined;
    }
});