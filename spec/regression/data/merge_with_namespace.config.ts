import {GraphQLObjectType, GraphQLSchema, GraphQLString} from "graphql";
import { ProxyConfig } from '../../../src/config/proxy-configuration';

export async function getConfig(): Promise<ProxyConfig> {
    return {
        endpoints: [
            {
                namespace: 'local1',
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query1',
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
                namespace: 'local2',
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query2',
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




