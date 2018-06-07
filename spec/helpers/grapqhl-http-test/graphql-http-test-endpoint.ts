import { GraphQLSchema } from 'graphql';
import { GraphQLServer } from 'graphql-yoga';
import { defaultTestSchema } from './graphql-http-test-schema';

export class GraphQLHTTPTestEndpoint {
    private server: { close(): void };

    public async start(port: number, schema?: GraphQLSchema) {
        const server = new GraphQLServer({
            schema: schema || defaultTestSchema
        });
        this.server = await server.start({
            port,
            endpoint: '/graphql'
        });
        console.log(`Test endpoint running on http://localhost:${port}/graphql`);
    }

    public stop() {
        this.server.close();
    }
}
