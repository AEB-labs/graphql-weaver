import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { GraphQLServer } from 'graphql-yoga';
import { WeavingConfig } from '../../src/config/weaving-config';
import { weaveSchemas } from '../../src/weave-schemas';
import { loadProxyConfig } from './load-config';

const defaultPort = 3200;

interface ServerConfig extends WeavingConfig {
    port?: number;
}

export async function start() {
    const configFileName = __dirname + '/../dev/config.json';
    const baseConfig: ServerConfig = await loadProxyConfig(configFileName);
    const config = {
        ...baseConfig,
        endpoints: [
            ...baseConfig.endpoints,
            {
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
            }
        ]
    };

    console.log('Loading schemas...');
    const schema = await weaveSchemas(config);

    const port = config.port || defaultPort;
    const server = new GraphQLServer({
        // graphql-yoga declares @types/graphql as regular dependency (in contrast to peerDependency)
        // updating to 1.8+ would fix it, but that causes a weird bug in the join tests,
        // probably related to their default fieldResolver (it does some magic with aliases...)
        schema: schema as any,
        context: () => ({}) // unique token
    });
    await server.start({
        port,
        endpoint: '/graphql'
    });
    console.log(`GraphQL server running on http://localhost:${port}/`);
}
