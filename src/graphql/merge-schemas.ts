import { GraphQLDirective, GraphQLField, GraphQLFieldConfig, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { arrayToObject, flatMap, mapAndCompact, mapValues, objectValues } from '../utils/utils';
import { isRootType } from './schema-utils';

/**
 * Merges multiple GraphQL schemas by merging the fields of root types (query, mutation, subscription)
 * @param schemas
 */
export function mergeSchemas(schemas: GraphQLSchema[]) {
    const nonRootTypes = flatMap(schemas, schema => objectValues(schema.getTypeMap()).filter(type => !isRootType(type, schema)));

    return new GraphQLSchema({
        query: mergeFields(schemas.map(schema => schema.getQueryType()), 'Query'),
        mutation: maybeMergeFields(mapAndCompact(schemas, schema => schema.getMutationType()), 'Mutation'),
        subscription: maybeMergeFields(mapAndCompact(schemas, schema => schema.getSubscriptionType()), 'Subscription'),
        directives: (<GraphQLDirective[]>[]).concat(...schemas.map(schema => schema.getDirectives())),

        // add types from type map, to avoid losing implementations of interfaces that are not referenced elsewhere
        // do not include root types of schemas because they are discared in favor of the new merged root types
        // no need to include the newly generated types, they are implicitly added
        types: nonRootTypes
    });
}

function mergeFields(types: GraphQLObjectType[], name: string) {
    return new GraphQLObjectType({
        name,
        description: `The merged ${name} root type`,
        fields: Object.assign({}, ...types.map(type => mapValues(type.getFields(), fieldToFieldConfig)))
    });
}

/**
 * See as #mergeFields but returns undefined if types is empty or null or undefined.
 */
function maybeMergeFields(types: GraphQLObjectType[], name: string) {
    if (types == undefined || types.length == 0) {
        return undefined;
    }
    return mergeFields(types, name);
}

function fieldToFieldConfig(field: GraphQLField<any, any>): GraphQLFieldConfig<any, any> {
    return {
        description: field.description,
        type: field.type,
        resolve: field.resolve,
        deprecationReason: field.deprecationReason,
        args: arrayToObject(field.args, arg => arg.name)
    };
}
