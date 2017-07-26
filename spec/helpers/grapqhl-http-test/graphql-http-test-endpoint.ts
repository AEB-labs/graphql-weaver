import { GraphQLSchema } from 'graphql';
import { defaultTestSchema } from './graphql-http-test-schema';
import { GraphQLServer } from '../server/graphql-server';

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