import {
    GraphQLEnumType,
    GraphQLEnumValueConfigMap,
    GraphQLFieldConfigArgumentMap,
    GraphQLFieldConfigMap,
    GraphQLFieldMap,
    GraphQLInputFieldConfigMap,
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLInterfaceType,
    GraphQLList,
    GraphQLNamedType,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLOutputType,
    GraphQLResolveInfo,
    GraphQLScalarType,
    GraphQLSchema,
    GraphQLType,
    GraphQLUnionType
} from "graphql";

/**
 * Creates a new schema that equals the given one but with all type names transformed by a custom callback
 */
export function renameTypes(schema: GraphQLSchema, transformer: (typeName: string) => string): GraphQLSchema {
    const typeMap: { [typeName: string]: GraphQLNamedType } = {};
    const originalTypes = Object.values(schema.getTypeMap());
    const originalInterfaces = originalTypes.filter(t => t instanceof GraphQLInterfaceType);

    function findType(name: string) {
        if (!(name in typeMap)) {
            throw new Error(`Unexpected reference to type ${name} which has not (yet) been renamed`);
        }
        return typeMap[name];
    }

    function processType(type: GraphQLNamedType) {
        typeMap[type.name] = renameType(type, transformer(type.name), findType);
    }

    // Dependencies between fields and their are broken up via GraphQL's thunk approach (fields are only requested when
    // needed, which is after all types have been converted). However, an object's reference to its implemented
    // interfaces does not support the thunk approach, so we need to make sure they are converted first
    originalTypes.filter(t => t instanceof GraphQLInterfaceType).forEach(processType);
    originalTypes.filter(t => !(t instanceof GraphQLInterfaceType)).forEach(processType);

    function findNewTypeMaybe(type: GraphQLObjectType|undefined) {
        if (!type) {
            return undefined;
        }
        const newType = findType(type.name);
        return <GraphQLObjectType>newType;
    }

    return new GraphQLSchema({
        types: Object.values(typeMap),
        directives: schema.getDirectives(), // TODO rename
        query: findNewTypeMaybe(schema.getQueryType())!,
        mutation: findNewTypeMaybe(schema.getMutationType()),
        subscription: findNewTypeMaybe(schema.getSubscriptionType()),
    });
}

type TypeResolver = (name: string) => GraphQLNamedType;

/**
 * Creates a new GraphQLType with a new name but otherwise the same configuration as the provided type. All named
 * types referenced within the type are sent through the typeResolver with their old name to determine the new type
 */
function renameType(type: GraphQLNamedType, name: string, typeResolver: TypeResolver) {
    if (type instanceof GraphQLScalarType) {
        return new GraphQLScalarType({
            name,
            description: type.description,
            serialize: type.serialize.bind(type),
            parseLiteral: type.parseLiteral.bind(type),
            parseValue: type.parseValue.bind(type)
        });
    }
    if (type instanceof GraphQLObjectType) {
        return renameObjectType(type, name, typeResolver);
    }
    if (type instanceof GraphQLInputObjectType) {
        return renameInputObjectType(type, name, typeResolver);
    }
    if (type instanceof GraphQLInterfaceType) {
        return renameInterfaceType(type, name, typeResolver);
    }
    if (type instanceof GraphQLUnionType) {
        return new GraphQLUnionType({
            name: name,
            description: type.description,
            types: type.getTypes().map(type => <GraphQLObjectType>typeResolver(type.name))
        });
    }
    if (type instanceof GraphQLEnumType) {
        return renameEnumType(type, name, typeResolver);
    }
    throw new Error(`Unsupported type: ${type}`);
}

function renameObjectType(type: GraphQLObjectType, name: string, typeResolver: TypeResolver) {
    return new GraphQLObjectType({
        name,
        description: type.description,
        fields: () => remapFieldTypes(type.getFields(), typeResolver),
        interfaces: type.getInterfaces().map(iface => <GraphQLInterfaceType>typeResolver(iface.name))
    });
}

function renameInterfaceType(type: GraphQLInterfaceType, name: string, typeResolver: TypeResolver) {
    return new GraphQLInterfaceType({
        name,
        description: type.description,
        fields: () => remapFieldTypes(type.getFields(), typeResolver),

        // this is likely not to work, so it should be overwritten later, but it's our best choice. Leaving it null
        // will cause the schema invariants to fail (either resolveType or isTypeOf needs to be implemented)
        resolveType: !type.resolveType ? undefined :
            (value: any,context: any, info: GraphQLResolveInfo) => type.resolveType(value, context, info)
    });
}

/**
 * Creates field configs for all provided fields, but with remapped types and argument types. All named
 * types are sent through the typeResolver with their old name to determine the new type.
 */
function remapFieldTypes(originalFields: GraphQLFieldMap<any, any>, typeResolver: TypeResolver): GraphQLFieldConfigMap<any, any> {
    const fields: GraphQLFieldConfigMap<any, any> = {};
    for (const fieldName in originalFields) {
        const originalField = originalFields[fieldName];
        const args: GraphQLFieldConfigArgumentMap = {};
        for (const arg of originalField.args) {
            args[arg.name] = {
                description: arg.description,
                type: <GraphQLInputType>remapType(arg.type, typeResolver),
                defaultValue: arg.defaultValue
            };
        }
        fields[fieldName] = {
            description: originalField.description,
            deprecationReason: originalField.deprecationReason,
            type: <GraphQLOutputType>remapType(originalField.type, typeResolver),
            args: args
        };
    }
    return fields;
}

function renameInputObjectType(type: GraphQLInputObjectType, name: string, typeResolver: TypeResolver) {
    const originalFields = type.getFields();
    function getFields() {
        const fields: GraphQLInputFieldConfigMap = {};
        for (const fieldName in originalFields) {
            const originalField = originalFields[fieldName];
            fields[fieldName] = {
                description: originalField.description,
                defaultValue: originalField.defaultValue,
                type: <GraphQLInputType>remapType(originalField.type, typeResolver)
            };
        }
        return fields;
    }

    return new GraphQLInputObjectType({
        name,
        description: type.description,
        fields: getFields
    });
}

function renameEnumType(type: GraphQLEnumType, name: string, typeResolver: TypeResolver) {
    const values: GraphQLEnumValueConfigMap = {};
    for (const originalValue of type.getValues()) {
        values[originalValue.name] = {
            description: originalValue.description,
            value: originalValue.value,
            deprecationReason: originalValue.deprecationReason
        };
    }

    return new GraphQLEnumType({
        name,
        description: type.description,
        values
    });
}

/**
 * Gets a GraphQLType of the same structure as type, but with the underlying named type replaced by the one provided
 * by namedTypeResolver for the same name
 */
function remapType(type: GraphQLType, namedTypeResolver: TypeResolver): GraphQLType {
    if (type instanceof GraphQLList) {
        return new GraphQLList(remapType(type.ofType, namedTypeResolver));
    }
    if (type instanceof GraphQLNonNull) {
        return new GraphQLNonNull(remapType(type.ofType, namedTypeResolver));
    }
    return namedTypeResolver(type.name);
}
