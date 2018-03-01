import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { weaveSchemas } from '../../src/weave-schemas';
import { GraphQLServer } from 'graphql-yoga';
import { WeavingConfig } from '../../src/config/weaving-config';
import { loadProxyConfig } from './load-config';

const defaultPort = 3200;

interface ServerConfig extends WeavingConfig {
    port?: number;
}

export async function start() {
    const configFileName = __dirname + '/../dev/config.json';
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
    const schema = await weaveSchemas(config);

    const port = config.port || defaultPort;
    const server = new GraphQLServer({
        schema,
        context: () => ({}) // unique token
    });
    await server.start({
        port,
        endpoint: '/graphql'
    });
    console.log(`GraphQL server running on http://localhost:${port}/`);
}
