import { GraphQLFieldConfigMap, GraphQLFieldResolver, GraphQLObjectType, GraphQLSchema } from 'graphql';

export interface NamedSchema {
    namespace: string
    schema: GraphQLSchema
    queryResolver?: GraphQLFieldResolver<any, any>
    mutationResolver?: GraphQLFieldResolver<any, any>
    subscriptionResolver?: GraphQLFieldResolver<any, any>
}

interface FieldConfig {
    namespace: string
    type: GraphQLObjectType
    resolver?: GraphQLFieldResolver<any, any>
}

/**
 * Creates a new GraphQLSchema where the operation root types have a field for each supplied schema
 */
export function mergeSchemas(schemas: NamedSchema[]) {
    const query = createRootFieldMaybe('Query', schemas.map(schema => ({
        namespace: schema.namespace,
        type: schema.schema.getQueryType(),
        resolver: schema.queryResolver
    })))!;

    const mutation = createRootFieldMaybe('Mutation', schemas.map(schema => ({
        namespace: schema.namespace,
        type: schema.schema.getMutationType(),
        resolver: schema.mutationResolver
    })));

    const subscription = createRootFieldMaybe('Subscription', schemas.map(schema => ({
        namespace: schema.namespace,
        type: schema.schema.getSubscriptionType(),
        resolver: schema.subscriptionResolver
    })));

    return new GraphQLSchema({
        query,
        mutation,
        subscription
    });
}

function createRootFieldMaybe(name: string, types: FieldConfig[]): GraphQLObjectType|undefined {
    const fields: GraphQLFieldConfigMap<any, any> = {};
    for (const {namespace, type, resolver} of types) {
        if (!type) {
            continue;
        }
        fields[namespace] = {
            type,
            resolve: resolver
        };
    }
    if (!Object.keys(fields).length) {
        return undefined;
    }

    return new GraphQLObjectType({
        name,
        fields
    });
}