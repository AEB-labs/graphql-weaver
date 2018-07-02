import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
    return {
        endpoints: [
            {
                url: "http://localhost:1337/graphql",
                fieldMetadata: {
                    'Person.nationality': {
                        link: {
                            field: "allCountries",
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
