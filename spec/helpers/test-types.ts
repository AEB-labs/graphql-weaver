import {
    GraphQLBoolean, GraphQLEnumType, GraphQLID, GraphQLInputObjectType, GraphQLInputType, GraphQLInt, GraphQLList,
    GraphQLObjectType,
    GraphQLString
} from 'graphql';
import { arrayToObject, mapValues, objectFromKeys } from '../../src/utils/utils';

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

    const continents = ['Europe', 'NorthAmerica', 'SouthAmerica', 'Asia', 'Australia', 'Antarctica', 'Africa'];

    export const continentType = new GraphQLEnumType({
        name: 'Continent',
        values: objectFromKeys(continents, key => ({}))
    });

    export const countryType = new GraphQLObjectType({
        name: 'Country',
        fields: {
            id: { type: GraphQLID},
            identCode: { type: GraphQLString },
            isoCode: { type: GraphQLString },
            description: { type: GraphQLString },
            continent: { type: continentType }
        }
    });

    export const countryFilterType = new GraphQLInputObjectType({
        name: 'CountryFilter',
        fields: {
            identCode_in: { type: new GraphQLList(GraphQLString) }
        },

    });


    export const personFilterType = new GraphQLInputObjectType({
        name: 'PersonFilter',
        fields: {
            isCool: { type: GraphQLBoolean }
        },

    });


}