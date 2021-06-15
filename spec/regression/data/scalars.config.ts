import { GraphQLInt, GraphQLObjectType, GraphQLScalarType, GraphQLSchema, GraphQLUnionType } from 'graphql';
import {testTypes} from "../../helpers/test-types";
import { WeavingConfig } from '../../../src/config/weaving-config';
import { isNumber } from "util";
import gql from 'graphql-tag';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { NonNegativeInt } from '../../helpers/non-negative-int';

export async function getConfig(): Promise<WeavingConfig> {
    function defaultIfNull<T>(value: T|undefined, defaultValue: T): T {
        if (value == undefined) {
            return defaultValue;
        }
        return value;
    }

    const typeDefs = gql`
        type Query {
            sum(lhs: NonNegativeInt, rhs: NonNegativeInt): NonNegativeInt
        }
        
        scalar NonNegativeInt
    `;

    const schema = makeExecutableSchema({
        typeDefs,
        resolvers: {
            NonNegativeInt,
            Query: {
                sum(source, args) {
                    if (args.lhs == undefined && args.rhs == undefined) {
                        return undefined;
                    }
                    return defaultIfNull(args.lhs, 0) + defaultIfNull(args.rhs, 0)
                }
            }
        }
    });

    return {
        endpoints: [
            {
                schema
            }
        ]
    };
}
