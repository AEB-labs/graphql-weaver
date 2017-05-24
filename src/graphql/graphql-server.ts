import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as cors from 'cors';
import {graphqlExpress, graphiqlExpress} from "graphql-server-express";
import {SchemaProvider} from "./schema-provider";
import {GraphQLOptions} from 'graphql-server-core';

export interface GraphQLServerConfig {
    readonly port: number;
    readonly schemaProvider: SchemaProvider;
}


export class GraphQLServer {
    constructor(private readonly config: GraphQLServerConfig) {
        const app = express();
        app.use(cors());
        app.use('/graphql', bodyParser.json(), graphqlExpress(() => this.getGraphQLOptions()));
        app.use('/graphiql', graphiqlExpress({endpointURL: '/graphql'}));

        app.listen(config.port);
    }

    private getGraphQLOptions(): GraphQLOptions {
        const schema = this.config.schemaProvider.getSchema();
        if (!schema) {
            throw new Error('Schema is not yet built, see console output for errors in the model');
        }
        return {
            schema
        };
    }
}