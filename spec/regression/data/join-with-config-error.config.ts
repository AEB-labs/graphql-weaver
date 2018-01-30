import { GraphQLList, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { WeavingConfig } from '../../../src/config/weaving-config';
import { testTypes } from '../../helpers/test-types';
import { WeavingErrorHandlingMode } from '../../../src/config/error-handling';

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
                            allPeople: {
                                type: new GraphQLList(testTypes.personType),
                                resolve: () => ([
                                    {nationality: 'DE', name: "Horst"},
                                    {nationality: 'DE', name: "Helga"},
                                    {nationality: 'FR', name: "Jacqueline"},
                                    {nationality: 'ZZ', name: "Zaphod"}])
                            }
                        }
                    })
                }),
                fieldMetadata: {
                    'Query.allPeople': {
                        join: {
                            // error: link field not configured
                            linkField: 'nationality'
                        }
                    }
                }
            }
        ],
        errorHandling: WeavingErrorHandlingMode.CONTINUE_AND_REPORT_IN_SCHEMA
    };
}
