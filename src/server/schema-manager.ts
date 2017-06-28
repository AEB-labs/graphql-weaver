import {SchemaProvider} from "./schema-provider";
import {GraphQLSchema} from "graphql";
import {ProxyConfig} from "../config/proxy-configuration";

export class SchemaManager implements SchemaProvider {
    private currentSchema?: GraphQLSchema = undefined;

    getSchema(): GraphQLSchema|undefined {
        return this.currentSchema;
    }

    private buildSchema(config: ProxyConfig) {

    }

}