import {GraphQLObjectType, GraphQLSchema} from 'graphql';
import {testTypes} from "../../helpers/test-types";
import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
    return {
        endpoints: [
            {
                namespace: 'namespacedEndpoint',
                url: "http://localhost:1337/graphql",
                typePrefix: 'Prefixed'
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            horst: {
                                type: testTypes.personType,
                                resolve: () => ({nationality: 'DE', name: "Horst"})
                            }
                        }
                    })
                })
            }
        ]
    };
}
