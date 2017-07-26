import { GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { ProxyConfig } from '../../../src/config/proxy-configuration';

const travellingPersonType = new GraphQLObjectType({
    name: 'TravellingPerson',
    fields: {
        name: { type: GraphQLString },
        visitedCountries: { type: new GraphQLList(GraphQLString) }
    }
});

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
                                type: travellingPersonType,
                                resolve: () => ({
                                    name: 'Horst',
                                    visitedCountries: ["DE", "FR", "XX"]
                                })
                            }
                        }
                    })
                }),
                fieldMetadata: {
                    'TravellingPerson.visitedCountries': {
                        link: {
                            field: 'staticData.allCountries',
                            argument: 'filter.identCode_in',
                            keyField: 'identCode',
                            batchMode: true
                        }
                    },
                }
            }
        ]
    };
}
