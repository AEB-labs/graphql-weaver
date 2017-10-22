import {
    GraphQLBoolean, GraphQLInt, GraphQLObjectType, GraphQLScalarType, GraphQLSchema, GraphQLString, ValueNode
} from 'graphql';
import {testTypes} from "../../helpers/test-types";
import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
    function isNiceName(str: string) {
        return str.match(/^[a-zA-Z]+$/);
    }

    const nameType = new GraphQLScalarType({
        name: 'Name',
        parseValue(value) {
            if (typeof value != 'string' || !isNiceName(value)) {
                throw new TypeError(`I don't like this name: ${value}`);
            }
            return value;
        },
        serialize(value) {
            if (typeof value != 'string' || !isNiceName(value)) {
                throw new TypeError(`I don't like this name: ${value}`);
            }
            return value;
        },
        parseLiteral(valueNode) {
            if (valueNode.kind == 'StringValue' && isNiceName(valueNode.value)) {
                return valueNode.value;
            }
            return null;
        }
    });

    const wifeType = new GraphQLObjectType({
        name: 'Wife',
        fields: {
            name: {
                type: GraphQLString
            },
            husband: {
                type: GraphQLString,
            }
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
                                type: new GraphQLObjectType({
                                    name: 'Person',
                                    fields: {
                                        name: {
                                            type: GraphQLString,
                                            resolve: () => 'Horst'
                                        },
                                        age: {
                                            type: GraphQLInt,
                                            resolve: () => { throw new Error('horst age not available'); }
                                        },
                                        validateName: {
                                            type: GraphQLBoolean,
                                            resolve: () => true,
                                            args: {
                                                name: {
                                                    type: nameType
                                                }
                                            }
                                        }
                                    }
                                }),
                                args: {
                                    name: {
                                        type: nameType
                                    }
                                },
                                resolve: () => ({})
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
                                type: wifeType,
                                resolve: () => ({name: 'Greta', husband: 'Horst' })
                            },
                            lisa: {
                                type: wifeType,
                                resolve: () => ({name: 'Lisa', husband: 'Hans-Joachim' })
                            }
                        }
                    })
                }),
                fieldMetadata: {
                    'Wife.husband': {
                        link: {
                            field: 'ns1.horst',
                            argument: 'name',
                            batchMode: false
                        }
                    }
                }
            }
        ]
    };
}
