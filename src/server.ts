import { GraphQLServer } from './graphql/graphql-server';
import { createProxySchema } from './graphql/schema';
import { loadProxyConfig } from './config/load-config';
import TraceError = require('trace-error');
import { DefaultEndpointFactory } from './endpoints/endpoint-factory';
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';

export async function start() {
    const configFileName = 'config.json';
    const config = await loadProxyConfig(configFileName);
    config.endpoints.push({
        name: 'local',
        links: {},
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

    const schemaManager = {
        getSchema: () => schema
    };
    const graphqlServer = new GraphQLServer({
        schemaProvider: schemaManager,
        port: config.port
    });
    console.log(`Started server on http://localhost:${config.port}`);
}
