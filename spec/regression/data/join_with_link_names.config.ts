import { ProxyConfig } from '../../../src/config/proxy-configuration';

export async function getConfig(): Promise<ProxyConfig> {
    return {
        endpoints: [
            {
                namespace: 'staticData',
                url: 'http://localhost:1337/graphql',
                typePrefix: 'CountryNS',
                fieldMetadata: {
                    'Person.nationality': {
                        link: {
                            field: 'staticData.allCountries',
                            argument: 'filter.identCode_in',
                            keyField: 'identCode',
                            batchMode: true,
                            linkFieldName: 'country'
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
