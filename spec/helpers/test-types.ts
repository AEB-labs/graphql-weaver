import {
    GraphQLBoolean, GraphQLID, GraphQLInputObjectType, GraphQLInputType, GraphQLInt, GraphQLList, GraphQLObjectType,
    GraphQLString
} from "graphql";

export namespace testTypes {
    export const carType = new GraphQLObjectType({
        name: 'Car',
        fields: {
            color: { type: GraphQLString },
            doorCount: { type: GraphQLInt }
        }
    });

    export const personType = new GraphQLObjectType({
        name: 'Person',
        fields: {
            name: { type: GraphQLString },
            isCool: { type: GraphQLBoolean },
            nationality: { type: GraphQLString },
        }
    });

    export const countryType = new GraphQLObjectType({
        name: 'Country',
        fields: {
            id: { type: GraphQLID},
            identCode: { type: GraphQLString },
            isoCode: { type: GraphQLString },
            description: { type: GraphQLString }
        }
    });

    export const countryFilterType = new GraphQLInputObjectType({
        name: 'CountryFilter',
        fields: {
            identCode_in: { type: new GraphQLList(GraphQLString) }
        },

    })


}