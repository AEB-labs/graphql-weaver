import {GraphQLObjectType, GraphQLSchema} from 'graphql';
import {testTypes} from "../../helpers/test-types";
import { ProxyConfig } from '../../../src/config/proxy-configuration';

export async function getConfig(): Promise<ProxyConfig> {
    return {
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
        ]
    };
}
