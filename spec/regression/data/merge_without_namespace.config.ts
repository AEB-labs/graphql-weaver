import {GraphQLObjectType, GraphQLSchema, GraphQLString} from "graphql";

export async function getConfig() {
    return {
        endpoints: [
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            info1: {
                                type: GraphQLString,
                                resolve: () => 'This is internal endpoint 1'
                            }
                        }
                    })
                })
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            info2: {
                                type: GraphQLString,
                                resolve: () => 'This is internal endpoint 2'
                            }
                        }
                    })
                })
            }

        ]
    };
}




