import { WeavingConfig } from '../../../src/config/weaving-config';
import gql from 'graphql-tag';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { NonNegativeInt } from '../../helpers/non-negative-int';

export async function getConfig(): Promise<WeavingConfig> {
    const typeDefs = gql`
        type Query {
            locations(filter: LocationFilter): [Location]
            events(filter: EventFilter): [Event]
        }

        type Event {
            location: String
            eventFilterValue: NonNegativeInt
        }

        type Location {
            name: String
            locationFilterValue: NonNegativeInt
        }

        input LocationFilter {
            names: [String]
            locationFilterValue: NonNegativeInt
        }

        input EventFilter {
            eventFilterValue: NonNegativeInt
        }

        scalar NonNegativeInt
    `;

    const schema = makeExecutableSchema({
        typeDefs,
        resolvers: {
            NonNegativeInt,
            Query: {
                locations(source, args) {
                    const locationFilterValue = args.filter.locationFilterValue;
                    return args.filter.names.map((name: string) => ({name, locationFilterValue}));
                },
                events(source, args) {
                    const eventFilterValue = args.filter.eventFilterValue;
                    return ['Berlin', 'Stuttgart', 'Munich'].map(location => ({location, eventFilterValue}));
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
