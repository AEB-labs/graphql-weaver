import {GraphQLBoolean, GraphQLInt, GraphQLNamedType, GraphQLObjectType, GraphQLSchema, GraphQLString} from "graphql";

const carType = new GraphQLObjectType({
    name: 'Car',
    fields: {
        color: { type: GraphQLString },
        doorCount: { type: GraphQLInt }
    }
});

const personType = new GraphQLObjectType({
    name: 'Person',
    fields: {
        name: { type: GraphQLString },
        isCool: { type: GraphQLBoolean }
    }
});


export async function getConfig() {
    return {
        endpoints: [
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            car: {
                                type: carType,
                                resolve: () => ({
                                    color: 'blue',
                                    doorCount: 3
                                })
                            }
                        }
                    }),
                    types: [carType]
                }),
                typePrefix: "CarsService"
            },
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            person: {
                                type: personType,
                                resolve: () => ({
                                    name: "Chuck Norris",
                                    isCool: true
                                })
                            }
                        }
                    }),
                    types: [personType]
                }),
                typePrefix: "PeopleService"
            },
        ]
    };
}




