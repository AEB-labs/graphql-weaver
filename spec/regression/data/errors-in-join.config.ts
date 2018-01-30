import { WeavingConfig } from '../../../src/config/weaving-config';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';
import { ASTNode, GraphQLError, GraphQLResolveInfo, ObjectValueNode } from 'graphql';
import { compact } from '../../../src/utils/utils';

export async function getConfig(): Promise<WeavingConfig> {
    const typeDefs = gql`
        type Query {
            locations(filter: LocationFilter): [Location]
            events: [Event]
        }

        type Event {
            location: String
        }

        type Location {
            name: String
        }

        input LocationFilter {
            names: [String]
        }
    `;

    const schema = makeExecutableSchema({
        typeDefs,
        resolvers: {
            Query: {
                locations(source, args, context, info: GraphQLResolveInfo) {
                    // note: we can't really test if the locations are properly propagated because, apart from the
                    // selection set, no nodes are passed from the original query to this join-data query.
                    // error locations within the selection sets are tested in errors-in-link.
                    throw new GraphQLError(`Runtime error in Query.locations`);
                },
                events() {
                    return ['Berlin', 'Stuttgart', 'Munich'].map(location => ({location}));
                }
            }
        }
    });

    return {
        endpoints: [
            {
                schema,
                fieldMetadata: {
                    'Event.location': {
                        link: {
                            field: 'locations',
                            argument: 'filter.names',
                            batchMode: true,
                            keyField: 'name'
                        }
                    },
                    'Query.events': {
                        join: {
                            linkField: 'location'
                        }
                    }
                }
            }
        ]
    };
}
