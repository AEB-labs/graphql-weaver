import {GraphQLBoolean, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLNamedType, GraphQLString} from "graphql";

const nativeTypes = [ GraphQLInt, GraphQLString, GraphQLBoolean, GraphQLFloat, GraphQLID ];

const nativeTypeMap: {[name: string]: GraphQLNamedType} = {};
for (const type of nativeTypes) {
    nativeTypeMap[type.name] = type;
}

export function isNativeGraphQLType(type: string|GraphQLNamedType) {
    const name = typeof type === 'string' ? type : type.name;
    return name in nativeTypeMap;
}
