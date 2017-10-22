import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import {testTypes} from "../../helpers/test-types";
import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
    return {
        endpoints: [
            {
                namespace: 'ns1',
                typePrefix: 'Ns1',
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            horst: {
                                type: GraphQLString,
                                resolve: () => { throw new Error('horst not available'); }
                            },
                            hans: {
                                type: GraphQLString,
                                resolve: () => 'Hans'
                            }
                        }
                    })
                })
            },

            {
                namespace: 'ns2',
                typePrefix: 'Ns2',
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            greta: {
                                type: GraphQLString,
                                resolve: () => 'Greta'
                            }
                        }
                    })
                })
            }
        ]
    };
}
