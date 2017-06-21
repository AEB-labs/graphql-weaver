import { GraphQLDirective, GraphQLField, GraphQLFieldConfig, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { arrayToObject, mapValues } from '../utils';

/**
 * Merges multiple GraphQL schemas by merging the fields of root types (query, mutation, subscription)
 * @param schemas
 */
export function mergeSchemas(schemas: GraphQLSchema[]) {
    return new GraphQLSchema({
        query: mergeFields(schemas.map(schema => schema.getQueryType()), 'Query'),
        mutation: mergeFields(schemas.map(schema => schema.getMutationType()).filter(a => a), 'Mutation'),
        subscription: mergeFields(schemas.map(schema => schema.getSubscriptionType()).filter(a => a), 'Subscription'),
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

function fieldToFieldConfig(field: GraphQLField<any, any>): GraphQLFieldConfig<any, any> {
    return {
        description: field.description,
        type: field.type,
        resolve: field.resolve,
        deprecationReason: field.deprecationReason,
        args: arrayToObject(field.args, arg => arg.name)
    };
}
