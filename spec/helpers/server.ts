import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { createProxySchema } from '../../src/proxy-schema';
import { GraphQLServer } from './server/graphql-server';
import { ProxyConfig } from '../../src/config/proxy-configuration';
import { loadProxyConfig } from './load-config';

const defaultPort = 3200;

interface ServerConfig extends ProxyConfig {
    port?: number;
}

export async function start() {
    const configFileName = 'config.json';
    const config: ServerConfig = await loadProxyConfig(configFileName);
    config.endpoints.push({
        typePrefix: 'Local',
        identifier: 'local',
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
    });

    console.log('Loading schemas...');
    const schema = await createProxySchema(config);

    const port = config.port || defaultPort;
    const schemaManager = {
        getSchema: () => schema
    };
    const graphqlServer = new GraphQLServer({
        schemaProvider: schemaManager,
        port
    });
}
