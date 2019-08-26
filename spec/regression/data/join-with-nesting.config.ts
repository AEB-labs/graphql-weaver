import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
    return {
        endpoints: [
            {
                namespace: 'staticData',
                url: "http://localhost:1337/graphql",
                typePrefix: 'CountryNS',
                fieldMetadata: {
                    'Person.nationality': {
                        link: {
                            field: "staticData.model.allCountries",
                            argument: "filter.identCode_in",
                            keyField: "identCode",
                            batchMode: true
                        }
                    },

                    'Query.allPeople': {
                        join: {
                            linkField: 'nationality'
                        }
                    }
                }
            }
        ]
    };
}
