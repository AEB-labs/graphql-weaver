import {GraphQLServer} from "./graphql/graphql-server";
import {GraphQLObjectType, GraphQLSchema, GraphQLString} from "graphql";
import {normalizeProxyConfig, ProxyConfig} from "./config/proxy-configuration";
import * as fs from "fs-extra";
import TraceError = require("trace-error");
import {createSchema} from "./graphql/schema";

async function loadConfig(fileName: string): Promise<ProxyConfig> {
    await fs.ensureFile(fileName);
    const contents = await fs.readFile(fileName, 'utf-8');
    let json;
    try {
        json = JSON.parse(contents);
    } catch (error) {
        throw new TraceError(`Config file ${fileName} is not a vaild JSON file: ${error.message}`, error);
    }
    return normalizeProxyConfig(json);
}

export async function start() {
    const configFileName = 'config.json';
    const config = await loadConfig(configFileName);
    console.log('Loading schemas...');
    const schema = await createSchema(config);

    const schemaManager = {
        getSchema: () => schema
    };
    const graphqlServer = new GraphQLServer({
        schemaProvider: schemaManager,
        port: config.port
    });
    console.log(`Started server on http://localhost:${config.port}`);
}
