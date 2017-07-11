import {GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString} from 'graphql';
import * as path from 'path';
import {loadProxyConfig} from '../../../src/config/load-config';
import {ProxyConfig} from "../../../src/config/proxy-configuration";
import {testTypes} from "../../helpers/test-types";

export async function getConfig(): Promise<ProxyConfig> {
    return {
        endpoints: [
            {
                namespace: 'staticData',
                url: "http://localhost:1337/graphql",
                typePrefix: 'CountryNS',
                fieldMetadata: {
                    'Person.nationality': {
                        link: {
                            field: "staticData.allCountries",
                            argument: "filter.identCode_in",
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
