import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
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
                            }
                        }
                    })
                })
            }
        ]
    };
}
