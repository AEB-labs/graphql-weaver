import {GraphQLFieldResolver, GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString} from "graphql";
import {GraphQLServer} from "../../../src/server/graphql-server";
import {defaultTestSchema} from "./graphql-http-test-schema";

export class GraphQLHTTPTestEndpoint {
  private graphqlServer: GraphQLServer;

  public start(port: number, schema?: GraphQLSchema) {

      if (!schema) {
          schema = defaultTestSchema;
      }

      const schemaManager = {
          getSchema: () => schema
      };

      this.graphqlServer = new GraphQLServer({
          schemaProvider: schemaManager,
          port
      });
  }

  public stop() {
      this.graphqlServer.stop();
  }

}