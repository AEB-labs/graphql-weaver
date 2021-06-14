import { BenchmarkConfig, BenchmarkFactories } from '../support/async-bench';
import { weaveSchemas } from '../../../src/weave-schemas';
import { graphql, GraphQLSchema, print } from 'graphql';
import gql from 'graphql-tag';
import { IResolvers, makeExecutableSchema } from 'graphql-tools';
import { assertSuccessfulResult } from '../../../src/graphql/execution-result';

function createSchema(size: number) {
    const types = gql`
        type Query {
            posts: [Post]
            allUsers(filter: UserFilter): [User]
        }

        input UserFilter {
            name_in: [String]
        }

        type Post {
            id: ID
            userName: String
        }

        type User {
            name: String
        }
    `;

    const posts: any[] = [];
    for (let i = 0; i < size; i++) {
        posts.push({id: i, userName: 'user' + i});
    }

    const resolvers: IResolvers = {
        Query: {
            posts: () => posts,
            allUsers: (root: any, args: any, context: any) => args.filter.name_in.map((name: string) => ({name: name}))
        }
    };

    const schema = makeExecutableSchema({typeDefs: print(types), resolvers});
    return weaveSchemas({
        endpoints: [{
            schema,
            fieldMetadata: {
                'Post.userName': {
                    link: {
                        field: 'allUsers',
                        keyField: 'name',
                        batchMode: true,
                        linkFieldName: 'user',
                        argument: 'filter.name_in'
                    }
                },
                'Query.posts': {
                    join: {
                        linkField: 'userName'
                    }
                }
            }
        }]
    })
}

const query = gql`{ posts { user { name } } }`;

function testJoin(size: number): BenchmarkConfig {
    let schema: GraphQLSchema;
    return {
        name: `join with ${size} objects`,
        async fn() {
            const result = await graphql(schema, print(query), {}, {}, {});
            assertSuccessfulResult(result);
        },
        async beforeAll() {
            schema = await createSchema(size);
        }
    };
}

export const JOIN_BENCHMARKS: BenchmarkFactories = [
    () => testJoin(10),
    () => testJoin(1000),
    () => testJoin(10000),
];
