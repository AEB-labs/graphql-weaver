import { GraphQLBoolean, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { ExtendedSchema, FieldMetadata, SchemaMetadata } from './extended-schema';

export const EXTENDED_INTROSPECTION_FIELD = '_extIntrospection';

export interface ExtendedIntrospectionData {
    types: {
        name: string,
        fields: Array<FieldMetadata & {
            name: string,
        }>
    }[]
}

export const EXTENDED_INTROSPECTION_QUERY = `{
    ${EXTENDED_INTROSPECTION_FIELD} {
        types { 
            name 
            fields { 
                name 
                link { 
                    endpoint 
                    field
                    argument
                    batchMode
                    keyField
                }
            }
        }
    }
}`;

export function supportsExtendedIntrospection(schema: GraphQLSchema) {
    return EXTENDED_INTROSPECTION_FIELD in schema.getQueryType().getFields();
}

let extendedIntrospectionType: GraphQLObjectType | undefined;

/**
 * Gets an object type to be used as a field called {@link EXTENDED_INTROSPECTION_FIELD} that exposes metadata in the
 * schema. The field value should be {@link ExtendedIntrospectionData}, as created by
 * {@link getExtendedIntrospectionData}
 */
export function getExtendedIntrospectionType(): GraphQLObjectType {
    if (!extendedIntrospectionType) {
        extendedIntrospectionType = createExtendedIntrospectionType();
    }
    return extendedIntrospectionType;
}

/**
 * Constructs the data for {@link getExtendedIntrospectionType()} from a SchemaMetadata
 */
export function getExtendedIntrospectionData(metadata: SchemaMetadata): ExtendedIntrospectionData {
    const keys = Array.from(metadata.fieldMetadata.keys());
    return {
        types: keys
            .map(key => key.split('.')[0])
            .map(typeName => ({
                name: typeName,
                fields: keys
                    .filter(key => key.startsWith(typeName + '.'))
                    .map(key => ({name: key.split('.', 2)[1], ...metadata.fieldMetadata.get(key)!}))
            }))
    };
}

/**
 * Builds a {@link SchemaMetadata} instance from the result of an extended introspection query
 * @param data
 */
export function buildSchemaMetadata(data: ExtendedIntrospectionData) {
    const map = new Map<string, FieldMetadata>();
    for (const type of data.types) {
        for (const field of type.fields) {
            const {name, ...metadata} = field;
            map.set(type.name + '.' + field.name, field);
        }
    }
    return new SchemaMetadata({fieldMetadata: map});
}

function createExtendedIntrospectionType(): GraphQLObjectType {
    const linkType = new GraphQLObjectType({
        name: '_FieldLink',
        fields: {
            endpoint: {
                description: 'The name of the endpoint this link points to',
                type: new GraphQLNonNull(GraphQLString)
            },
            field: {
                description: 'The field or a dot-separated list of fields starting from the endpoint\'s query type that is used to resolve the link',
                type: new GraphQLNonNull(GraphQLString)
            },
            batchMode: {
                description: 'If true, the field returns a list of objects instead of one object',
                type: new GraphQLNonNull(GraphQLBoolean)
            },
            argument: {
                description: 'The argument name, optionally followed by a dot-separated path of input field names, that is to be set to the id (or list of ids in case of batchMode)',
                type: new GraphQLNonNull(GraphQLString)
            },
            keyField: {
                description: 'The name of a field in the target type that contains the id. Only needed if batchMode is true and the field may return the objects out of order',
                type: GraphQLString
            }
        }
    });

    const fieldType = new GraphQLObjectType({
        name: '_ExtendedField',
        fields: {
            name: {
                description: 'The field name',
                type: GraphQLString
            },

            link: {
                description: 'Specifies if this field should be resolved as a link to a different endpoint',
                type: linkType
            }
        }
    });

    const typeType = new GraphQLObjectType({
        name: '_ExtendedType',
        fields: {
            name: {
                description: 'The type name',
                type: GraphQLString
            },

            fields: {
                description: 'A list of all fields of this type that have extended information',
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(fieldType)))
            }
        }
    });

    return new GraphQLObjectType({
        name: '_ExtendedIntrospection',
        description: 'Offers non-standard type information',
        fields: {
            types: {
                description: 'A list of all types that have extended information',
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(typeType)))
            }
        }
    });
}
