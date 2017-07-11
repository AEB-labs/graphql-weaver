import {GraphQLObjectType, GraphQLSchema} from 'graphql';
import {ProxyConfig} from "../../../src/config/proxy-configuration";
import {testTypes} from "../../helpers/test-types";

export async function getConfig() {
    return <ProxyConfig>{
        endpoints: [
            {
                namespace: 'namespacedEndpoint',
                url: "http://localhost:1337/graphql",
                typePrefix: 'Prefixed'
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            horst: {
                                type: testTypes.personType,
                                resolve: () => ({nationality: 'DE', name: "Horst"})
                            }
                        }
                    })
                })
            }
        ],
        port: 3100
    };
}
