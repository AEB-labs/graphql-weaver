import {GraphQLObjectType, GraphQLSchema, GraphQLString} from "graphql";

export async function getConfig() {
    return {
        endpoints: [
            {
                name: 'local',
                typePrefix: 'Local',
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            info: {
                                type: GraphQLString,
                                resolve: () => 'This is an internal endpoint'
                            }
                        }
                    })
                })
            }
        ]
    };
}




