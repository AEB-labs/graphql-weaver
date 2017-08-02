import { GraphQLBoolean, GraphQLID, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { ProxyConfig } from '../../../src/config/proxy-configuration';

export async function getConfig(): Promise<ProxyConfig> {
    return {
        endpoints: [
            {
                namespace: 'staticData',
                url: "http://localhost:1337/graphql",
                typePrefix: 'CountryNS'
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            horst: {
                                type: new GraphQLObjectType({
                                    name: 'Person',
                                    fields: {
                                        name: { type: GraphQLString },
                                        isCool: { type: GraphQLBoolean },
                                        nationality: { type: GraphQLID }, // this is the incompatibility
                                    }
                                }),
                                resolve: () => ({nationality: 'DE', name: "Horst"})
                            }
                        }
                    })
                }),
                fieldMetadata: {
                    'Person.nationality': {
                        link: {
                            field: "staticData.Country",
                            argument: "identCode",
                            batchMode: false
                        }
                    },
                }
            }
        ]
    };
}
