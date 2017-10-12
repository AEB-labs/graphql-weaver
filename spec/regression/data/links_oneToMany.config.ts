import { GraphQLList, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { WeavingConfig } from '../../../src/config/weaving-config';
import { testTypes } from '../../helpers/test-types';

export async function getConfig(): Promise<WeavingConfig> {
    return {
        endpoints: [
            {
                namespace: "staticData",
                url: "http://localhost:1337/graphql",
                typePrefix: "PeopleNS"
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'DeutschlandQuery',
                        fields: {
                            Deutschland: {
                                type: testTypes.countryType,
                                resolve: () => (    {
                                    "id": "ciz5mqjwg80bk0196qbgm1qny",
                                    "identCode": "DE",
                                    "isoCode": "DE",
                                    "description": "Deutschland",
                                    "continent": "Europe"
                                })
                            }
                        }
                    })
                }),
                fieldMetadata: {
                    'Country.identCode': {
                        link: {
                            field: "staticData.allPeople",
                            argument: "nationality",
                            oneToMany: true,
                            batchMode: false,
                            linkFieldName: "people"
                        }
                    },
                }
            }
        ]
    };
}
