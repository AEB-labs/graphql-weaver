import {
    GraphQLBoolean, GraphQLInt, GraphQLList, GraphQLObjectType, GraphQLScalarType, GraphQLSchema, GraphQLString
} from 'graphql';
import { WeavingConfig } from '../../../src/config/weaving-config';
import { WeavingErrorHandlingMode } from '../../../src/config/error-handling';

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
                            },

                            horstByNameBroken: {
                                type: new GraphQLList(new GraphQLObjectType({
                                    name: 'HorstByNameBroken',
                                    fields: {
                                        name: {
                                            type: GraphQLString,
                                            resolve: () => 'Horst'
                                        },
                                    }
                                })),
                                args: {
                                    name: {
                                        type: new GraphQLList(nameType)
                                    }
                                },
                                resolve: () => { throw new Error('No horst by name'); }
                            },

                            horstByName: { // tbh, broken, too
                                type: new GraphQLList(new GraphQLObjectType({
                                    name: 'HorstByName',
                                    fields: {
                                        name: {
                                            type: GraphQLString,
                                            resolve: () => { throw new Error('No name for this horst') }
                                        },
                                    }
                                })),
                                args: {
                                    name: {
                                        type: new GraphQLList(nameType)
                                    }
                                },
                                resolve: () => [{},{}]
                            },
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
                            },
                            gretaLinkBroken: {
                                type: new GraphQLObjectType({
                                    name: 'GretaLinkBroken',
                                    fields: {
                                        name: {
                                            type: GraphQLString // need string here instead of name because we want this resolver *not* to fail when returning the bad names
                                        },
                                        husband: {
                                            type: nameType
                                        },
                                    }
                                }),
                                resolve: () => ({name: 'Greta', husband: 'Horst' })
                            },
                            gretaKeyBroken: {
                                type: new GraphQLObjectType({
                                    name: 'GretaKeyBroken',
                                    fields: {
                                        name: {
                                            type: GraphQLString
                                        },
                                        husband: {
                                            type: nameType
                                        },
                                    }
                                }),
                                resolve: () => ({name: 'Greta', husband: 'Horst' })
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
                    },
                    'GretaLinkBroken.husband': {
                        link: {
                            field: 'ns1.horstByNameBroken',
                            argument: 'name',
                            batchMode: true,
                            keyField: 'name'
                        }
                    },
                    'GretaKeyBroken.husband': {
                        link: {
                            field: 'ns1.horstByName',
                            argument: 'name',
                            batchMode: true,
                            keyField: 'name'
                        }
                    }
                }
            }
        ],
        errorHandling: WeavingErrorHandlingMode.CONTINUE_AND_REPORT_IN_SCHEMA
    };
}
