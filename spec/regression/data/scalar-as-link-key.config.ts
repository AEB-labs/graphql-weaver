import { WeavingConfig } from '../../../src/config/weaving-config';
import gql from 'graphql-tag';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { NonNegativeInt } from '../../helpers/non-negative-int';

export async function getConfig(): Promise<WeavingConfig> {

    const typeDefs = gql`
        type Query {
            locations(filter: LocationFilter): [Location]
            events: [Event]
        }
        
        type Event {
            location: NonNegativeInt
        }
        
        type Location {
            id: NonNegativeInt
        }
        
        input LocationFilter {
            ids: [NonNegativeInt]
        }
        
        scalar NonNegativeInt
    `;

    const schema = makeExecutableSchema({
        typeDefs,
        resolvers: {
            NonNegativeInt,
            Query: {
                locations(source, args) {
                    return args.filter.ids.map((id: number) => ({ id }));
                },
                events() {
                    return [ { location: 0, }, { location: 1 }, { location: null }]
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
                            argument: 'filter.ids',
                            batchMode: true,
                            keyField: 'id'
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
