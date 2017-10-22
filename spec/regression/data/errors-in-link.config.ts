import { GraphQLInt, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import {testTypes} from "../../helpers/test-types";
import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
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
                                        }
                                    }
                                }),
                                args: {
                                    name: {
                                        type: GraphQLString
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
                                type: new GraphQLObjectType({
                                    name: 'Greta',
                                    fields: {
                                        name: {
                                            type: GraphQLString,
                                            resolve: () => 'Greta'
                                        },
                                        husband: {
                                            type: GraphQLString,
                                            resolve: () => 'Horst'
                                        }
                                    }
                                }),
                                resolve: () => ({})
                            }
                        }
                    })
                }),
                fieldMetadata: {
                    'Greta.husband': {
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
