import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
    const linkTargetType = new GraphQLObjectType({
        name: 'OpNameObject',
        fields: {
            opName: {
                type: GraphQLString,
                resolve: (source, args, context, info) => info.operation.name ? info.operation.name.value : null
            },
        }
    });

    return {
        endpoints: [
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            opName: {
                                type: GraphQLString,
                                resolve: (source, args, context, info) => info.operation.name ? info.operation.name.value : null
                            },

                            linkTarget: {
                                type: linkTargetType,
                                args: {
                                    // just to please link module
                                    id: {
                                        type: GraphQLString
                                    }
                                },
                                resolve: () => ({})
                            },

                            link: {
                                type: GraphQLString,
                                resolve: () => 'dummy'
                            }
                        }
                    })
                }),
                fieldMetadata: {
                    'Query.link': {
                        link: {
                            field: 'linkTarget',
                            argument: 'id',
                            batchMode: false
                        }
                    }
                }
            }
        ]
    };
}
