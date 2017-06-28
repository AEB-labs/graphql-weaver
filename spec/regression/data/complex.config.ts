import {GraphQLObjectType, GraphQLSchema, GraphQLString} from "graphql";
import {normalizeProxyConfig, ProxyConfig} from "../../../src/config/proxy-configuration";
import * as fs from 'fs-extra';
import * as path from "path";
import {loadProxyConfig} from "../../../src/config/load-config";

export async function getConfig() {
    const configFromFile = await loadProxyConfig(path.join(__dirname, 'complex.config.json'));
    configFromFile.endpoints.push({
        name: 'local',
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
    });
    return configFromFile;
}
