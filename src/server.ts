import {GraphQLServer} from "./graphql/graphql-server";
import {GraphQLObjectType, GraphQLSchema, GraphQLString} from "graphql";

const PORT = 3100;

export function start() {
    const schemaManager = {
        getSchema() {
            return new GraphQLSchema({
                query: new GraphQLObjectType({name: 'Query', fields: {test: {type: GraphQLString}}})
            })
        }
    };
    const graphqlServer = new GraphQLServer({
        schemaProvider: schemaManager,
        port: PORT
    });
    console.log(`Started server on http://localhost:${PORT}`);
}
