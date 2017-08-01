import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { testTypes } from '../../helpers/test-types';
import { ProxyConfig } from '../../../src/config/proxy-configuration';

export async function getConfig(): Promise<ProxyConfig> {
    return {
        endpoints: [
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            car: {
                                type: testTypes.carType,
                                resolve: () => ({
                                    color: 'blue',
                                    doorCount: 3
                                })
                            }
                        }
                    }),
                    types: [testTypes.carType]
                })
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            person: {
                                type: testTypes.personType,
                                resolve: () => ({
                                    name: "Chuck Norris",
                                    isCool: true
                                })
                            }
                        }
                    }),
                    types: [testTypes.personType]
                })
            }

        ]
    };
}




