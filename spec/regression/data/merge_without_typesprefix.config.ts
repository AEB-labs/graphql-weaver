import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { testTypes } from '../../helpers/test-types';
import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
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




