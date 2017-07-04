import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { ProxyConfig } from '../../../src/config/proxy-configuration';

export async function getConfig(): Promise<ProxyConfig> {
    return {
        endpoints: [
            {
                namespace: 'local',
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




