import { GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { weaveSchemas } from '../../../src/weave-schemas';
import { testTypes } from '../../helpers/test-types';

const people: { [name: string]: string } = {
    Horst: 'DE',
    Helga: 'DE',
    Jacqueline: 'FR',
    Zahpod: 'ZZ'
};

export const teamType = new GraphQLObjectType({
    name: 'Team',
    fields: {
        name: {type: GraphQLString},
        teamLead: {type: GraphQLString}
    }
});

export async function getConfig(): Promise<GraphQLSchema> {
    const innerSchema = await weaveSchemas({
        endpoints: [
            {
                namespace: 'staticData',
                url: 'http://localhost:1337/graphql',
                typePrefix: 'CountryNS'
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            person: {
                                type: testTypes.personType,
                                args: {
                                    name: {
                                        type: GraphQLString
                                    }
                                },
                                resolve: (source, {name}) => (name in people) ? {
                                    name, nationality: people[name]
                                } : undefined
                            }
                        }
                    })
                }),
                fieldMetadata: {
                    'Person.nationality': {
                        link: {
                            field: 'staticData.Country',
                            argument: 'identCode',
                            batchMode: false
                        }
                    }
                }
            }
        ]
    });

    return await weaveSchemas({
        endpoints: [
            {
                schema: innerSchema
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            allTeams: {
                                type: new GraphQLList(teamType),
                                resolve: () => ([
                                    {name: 'Team Blue', teamLead: 'Horst'},
                                    {name: 'Team Red', teamLead: 'Jacqueline'}
                                ])
                            }
                        }
                    })
                }),
                fieldMetadata: {
                    'Team.teamLead': {
                        link: {
                            field: 'person',
                            argument: 'name',
                            batchMode: false
                        }
                    }
                }
            }
        ]
    });
}
