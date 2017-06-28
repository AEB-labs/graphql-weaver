import { GraphQLDirective, GraphQLField, GraphQLFieldConfig, GraphQLObjectType, GraphQLSchema } from 'graphql';
import {arrayToObject, mapAndCompact, mapValues} from '../utils/utils';

/**
 * Merges multiple GraphQL schemas by merging the fields of root types (query, mutation, subscription)
 * @param schemas
 */
export function mergeSchemas(schemas: GraphQLSchema[]) {
    return new GraphQLSchema({
        query: mergeFields(schemas.map(schema => schema.getQueryType()), 'Query'),
        mutation: maybeMergeFields(mapAndCompact(schemas, schema => schema.getMutationType()), 'Mutation'),
        subscription: maybeMergeFields(mapAndCompact(schemas, schema => schema.getSubscriptionType()), 'Subscription'),
        directives: (<GraphQLDirective[]>[]).concat(...schemas.map(schema => schema.getDirectives()))
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
