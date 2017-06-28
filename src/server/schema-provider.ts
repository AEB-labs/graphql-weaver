import {GraphQLSchema} from "graphql";

export interface SchemaProvider {
    getSchema(): GraphQLSchema|undefined;
}