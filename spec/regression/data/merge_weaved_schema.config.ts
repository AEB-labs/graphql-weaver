import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { WeavingConfig } from '../../../src/config/weaving-config';
import { weaveSchemas } from '../../../src/weave-schemas';
import { testTypes } from '../../helpers/test-types';

export async function getConfig(): Promise<WeavingConfig> {

    const schema = await weaveSchemas({
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
            }
        ]
    });

    return {
        endpoints: [
            {
                schema: schema
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            person: {
                                type: testTypes.personType,
                                resolve: () => ({
                                    name: 'Chuck Norris',
                                    isCool: true
                                })
                            }
                        }
                    }),
                    types: [testTypes.personType]
                }),
                namespace: 'local',
                typePrefix: 'Local'
            }

        ]
    };
}




