import { ApolloServer } from 'apollo-server';
import { GraphQLSchema } from 'graphql';
import { defaultTestSchema } from './graphql-http-test-schema';

export class GraphQLHTTPTestEndpoint {
    private server: ApolloServer | undefined;

    public async start(port: number, schema?: GraphQLSchema) {
        const server = new ApolloServer({
            schema: schema || defaultTestSchema
        });
        await server.listen(port);
        console.log(`Test endpoint running on http://localhost:${port}/`)
        this.server = server;
    }

    public stop() {
        if (this.server) {
            this.server.stop();
            this.server = undefined;
        }
    }
}
