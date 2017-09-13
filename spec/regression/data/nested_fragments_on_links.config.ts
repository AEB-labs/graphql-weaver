import {GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString} from 'graphql';
import {testTypes} from "../../helpers/test-types";
import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
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
                                type: testTypes.personType,
                                resolve: () => ({nationality: 'DE', name: "Horst"})
                            },
                            allPeople: {
                                type: new GraphQLList(testTypes.personType),
                                resolve: () => ([
                                    {nationality: 'DE', name: "Horst"},
                                    {nationality: 'DE', name: "Helga"},
                                    {nationality: 'FR', name: "Jacqueline"}])
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
