import { GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { WeavingConfig } from '../../../src/config/weaving-config';
import { testTypes } from '../../helpers/test-types';
import continentType = testTypes.continentType;

export async function getConfig(): Promise<WeavingConfig> {
    return {
        endpoints: [
            {
                namespace: 'staticData',
                url: 'http://localhost:1337/graphql',
                typePrefix: 'CountryNS'
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            countries: {
                                type: new GraphQLList(GraphQLString),
                                args: {
                                    continent: {
                                        type: continentType
                                    }
                                },
                                resolve: (source, args: { continent?: string }) => {
                                    switch (args.continent) {
                                        case 'Europe':
                                            return ['DE', 'FR'];
                                        case 'NorthAmerica':
                                            return ['US'];
                                        default:
                                            throw new Error('continent is not provided');
                                    }
                                }
                            }
                        }
                    })
                }),
                fieldMetadata: {
                    'Query.countries': {
                        link: {
                            field: 'staticData.Country',
                            argument: 'identCode',
                            batchMode: false
                        }
                    }
                }
            }
        ]
    };
}
