import {GraphQLObjectType, GraphQLSchema, GraphQLString} from "graphql";
import { ProxyConfig } from '../../../src/config/proxy-configuration';

export async function getConfig(): Promise<ProxyConfig> {
    return {
        endpoints: [
            {
                namespace: 'ns',
                typePrefix: "Namespace",
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            a: {
                                type: GraphQLString,
                                resolve() { return "a"; }
                            },
                            b: {
                                type: GraphQLString,
                                resolve() { return "b"; }
                            }
                        }
                    })
                })
            }
        ]
    };
}
