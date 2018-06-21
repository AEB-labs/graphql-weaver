import { DocumentNode, graphql, GraphQLInt, GraphQLObjectType, GraphQLSchema, GraphQLString, print } from 'graphql';
import { Response } from 'node-fetch';
import { WeavingConfig } from '../../../src/config/weaving-config';
import { HttpGraphQLClient } from '../../../src/graphql-client/http-client';
import { NonNegativeInt } from '../../helpers/non-negative-int';

class ErrorWithExtension extends Error {
    extensions = {
        code: 'TEST'
    };

    constructor(message: string) {
        super(message);
    }
}

export async function getConfig(): Promise<WeavingConfig> {
    const facSchema = new GraphQLSchema({
        query: new GraphQLObjectType({
            name: 'Query',
            fields: {
                factorial: {
                    type: GraphQLInt,
                    resolve: (source, args, context) => fac(args['value']),
                    args: {
                        value: {
                            type: NonNegativeInt
                        }
                    }
                },
                math: {
                    type: new GraphQLObjectType({
                        name: 'Math',
                        fields: {
                            factorial: {
                                type: GraphQLInt,
                                resolve: (source, args, context) => fac(args['value']),
                                args: {
                                    value: {
                                        type: NonNegativeInt
                                    }
                                }
                            }
                        }
                    }),
                    resolve: () => ({})
                }
            }
        })
    });

    class FakeHttpGraphQLClient extends HttpGraphQLClient {
        constructor(private schema: GraphQLSchema) {
            super({ url: '' });
        }

        async fetchResponse(document: DocumentNode, variables?: { [name: string]: any }, context?: any) {
            const result = await graphql(this.schema, print(document), {}, context, variables);
            return new Response(JSON.stringify(result));
        }
}

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
                            extensions: {
                                type: GraphQLString,
                                resolve: () => { throw new ErrorWithExtension('should have extensions') }
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
                namespace: 'facLocal',
                typePrefix: 'FacLocal',
                schema: facSchema
            },

            {
                namespace: 'facRemote',
                typePrefix: 'FacRemote',
                client: new FakeHttpGraphQLClient(facSchema)
            }
        ]
    };
}

function fac(a: number): number {
    if (a <= 1) {
        return 1;
    }
    return fac(a - 1) * fac(a - 2);
}
