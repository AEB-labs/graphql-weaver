import { GraphQLInt, GraphQLObjectType, GraphQLScalarType, GraphQLSchema, GraphQLString, ValueNode } from 'graphql';
import {testTypes} from "../../helpers/test-types";
import { WeavingConfig } from '../../../src/config/weaving-config';
import { isNumber } from 'util';

export async function getConfig(): Promise<WeavingConfig> {
    const nonNegativeIntType = new GraphQLScalarType({
        name: 'NonNegativeInt',
        parseValue(value: ValueNode) {
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
                return valueNode.value;
            }
            return null;
        }
    });

    return {
        endpoints: [
            {
                namespace: 'ns1',
                typePrefix: 'Ns1',
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            horst: {
                                type: GraphQLString,
                                resolve: () => { throw new Error('horst not available'); }
                            },
                            hans: {
                                type: GraphQLString,
                                resolve: () => 'Hans'
                            }
                        }
                    })
                })
            },

            {
                namespace: 'ns2',
                typePrefix: 'Ns2',
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            greta: {
                                type: GraphQLString,
                                resolve: () => 'Greta'
                            }
                        }
                    })
                })
            },

            {
                namespace: 'ns3',
                typePrefix: 'Ns3',
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            factorial: {
                                type: GraphQLInt,
                                resolve: (source, args, context) => fac(args['value']),
                                args: {
                                    value: {
                                        type: nonNegativeIntType
                                    }
                                }
                            }
                        }
                    })
                })
            },
        ]
    };
}

function fac(a: number): number {
    if (a <= 1) {
        return 1;
    }
    return fac(a - 1) * fac(a - 2);
}
