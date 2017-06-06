import {
    GraphQLBoolean, GraphQLDirective, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLNamedType, GraphQLString,
    specifiedDirectives
} from 'graphql';

const nativeTypes = [ GraphQLInt, GraphQLString, GraphQLBoolean, GraphQLFloat, GraphQLID ];

const nativeTypeMap: {[name: string]: GraphQLNamedType} = {};
for (const type of nativeTypes) {
    nativeTypeMap[type.name] = type;
}

/**
 * Determines if the given type is natively included in any GraphQL schema (and it is not an introspection type)
 * @param type a GraphQLType or a a type name
 * @returns true for native types, false for other types and for introspection types
 */
export function isNativeGraphQLType(type: string|GraphQLNamedType) {
    const name = typeof type === 'string' ? type : type.name;
    return name in nativeTypeMap;
}

const nativeDirectiveMap: {[name: string]: GraphQLDirective} = {};
for (const directive of specifiedDirectives) {
    nativeDirectiveMap[directive.name]  = directive;
}

/**
 * Determines if the given directive is natively included in any GraphQL schema
 *
 * This function uses name equality to compare directives, not referential equality. Thus, directives generated from an
 * introspection query with the correct name will be identified as native directives. However, it also means that
 * non-standard directives with native names will be treated as if they were native directives.
 *
 * @param directive a GraphQLDirective or a a directive name
 * @returns true for native directives, false otherwise
 */
export function isNativeDirective(directive: string|GraphQLDirective) {
    const name = typeof directive === 'string' ? directive  : directive.name;
    return name in nativeDirectiveMap;
}
