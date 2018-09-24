import { GraphQLSchema } from 'graphql';
import { GraphQLServer } from 'graphql-yoga';
import { defaultTestSchema } from './graphql-http-test-schema';

export class GraphQLHTTPTestEndpoint {
    private server: { close(): void } | undefined;

    public async start(port: number, schema?: GraphQLSchema) {
        const server = new GraphQLServer({
            // graphql-yoga declares @types/graphql as regular dependency (in contrast to peerDependency)
            // updating to 1.8+ would fix it, but that causes a weird bug in the join tests,
            // probably related to their default fieldResolver (it does some magic with aliases...)
            schema: schema || defaultTestSchema as any
        });
        this.server = await server.start({
            port,
            endpoint: '/graphql'
        });
        console.log(`Test endpoint running on http://localhost:${port}/`);
    }

    public stop() {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
    }
}
