import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import * as path from 'path';
import { loadProxyConfig } from '../../../src/config/load-config';

export async function getConfig() {
    const configFromFile = await loadProxyConfig(path.join(__dirname, 'complex.config.json'));
    return {
        ...configFromFile,
        endpoints: [
            ...configFromFile.endpoints,
            {
                namespace: 'local',
                typePrefix: 'Local',
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            info: {
                                type: GraphQLString,
                                resolve: () => 'This is an internal endpoint'
                            }
                        }
                    })
                })
            }
        ]
    };
}
