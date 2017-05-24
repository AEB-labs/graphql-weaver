import {GraphQLFieldConfigMap, GraphQLObjectType, GraphQLSchema} from "graphql";

type NamedSchema = { namespace: string, schema: GraphQLSchema };

/**
 * Creates a new GraphQLSchema where the operation root types have a field for each supplied schema
 */
export function mergeSchemas(schemas: NamedSchema[]) {
    const query = createObjectTypeMaybe('Query', schemas.map(schema => ({
        namespace: schema.namespace,
        type: schema.schema.getQueryType()
    })))!;

    const mutation = createObjectTypeMaybe('Mutation', schemas.map(schema => ({
        namespace: schema.namespace,
        type: schema.schema.getMutationType()
    })));

    const subscription = createObjectTypeMaybe('Subscription', schemas.map(schema => ({
        namespace: schema.namespace,
        type: schema.schema.getSubscriptionType()
    })));

    return new GraphQLSchema({
        query,
        mutation,
        subscription
    });
}

function createObjectTypeMaybe(name: string, types: { namespace: string, type: GraphQLObjectType }[]): GraphQLObjectType|undefined {
    const fields: GraphQLFieldConfigMap<any, any> = {};
    for (const {namespace, type} of types) {
        if (!type) {
            continue;
        }
        fields[namespace] = {
            type
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