import {SchemaProvider} from "./schema-provider";
import {GraphQLSchema} from "graphql";
import { WeavingConfig } from '../../../src/config/weaving-config';

export class SchemaManager implements SchemaProvider {
    private currentSchema?: GraphQLSchema = undefined;

    getSchema(): GraphQLSchema|undefined {
        return this.currentSchema;
    }

    private buildSchema(config: WeavingConfig) {

    }

}