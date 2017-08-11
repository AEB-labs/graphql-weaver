import { GraphQLBoolean, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import { FieldMetadata, SchemaMetadata } from './extended-schema';
import { filterValuesDeep } from '../utils/utils';

export const EXTENDED_INTROSPECTION_FIELD = '_extIntrospection';
export const EXTENDED_INTROSPECTION_TYPE_NAMES = {
    introspection: '_ExtendedIntrospection',
    type: '_ExtendedType',
    field: '_ExtendedField',
    fieldMetadata: '_FieldMetadata',
    fieldLink: '_FieldLink',
    fieldJoin: '_FieldJoin'
};

export interface ExtendedIntrospectionData {
    types: {
        name: string,
        fields: {
            name: string,
            metadata: FieldMetadata
        }[]
    }[]
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
                    .map(key => ({name: key.split('.', 2)[1], metadata: metadata.fieldMetadata.get(key)!}))
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
            // remove the null fields of GraphQL because fields in FieldMetadata are marked as optional and not with |null.
            const fieldMetadata: FieldMetadata = filterValuesDeep(field.metadata, val => val != undefined);
            map.set(type.name + '.' + field.name, fieldMetadata);
        }
    }
    return new SchemaMetadata({fieldMetadata: map});
}

function createExtendedIntrospectionType(): GraphQLObjectType {
    const linkType = new GraphQLObjectType({
        name: EXTENDED_INTROSPECTION_TYPE_NAMES.fieldLink,
        description: 'Configuration of a link on a field. If this metadata is present, the consumer should replace the type of the field with the type of the linked field and, for the value of this field, fetch objects from the linked field according to this config',
        fields: {
            field: {
                description: 'The field or a dot-separated list of fields starting from the query type that is used to resolve the link',
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
            },
            linkFieldName: {
                description: 'If specified, a new field with this name will be added with the target type. If not specified, the annotated field will be replaced with the link field.',
                type: GraphQLString
            },
            ignore: {
                description: 'Indicates that the link has already been processed.',
                type: GraphQLBoolean
            }
        }
    });

    const joinType = new GraphQLObjectType({
        name: EXTENDED_INTROSPECTION_TYPE_NAMES.fieldJoin,
        description: 'Configuration on how to join filters, ordering and limiting of a linked child field into this field',
        fields: {
            linkField: {
                description: 'The name of the child field that has a link configured',
                type: new GraphQLNonNull(GraphQLString)
            },
            ignore: {
                description: 'Indicates that the join has already been processed.',
                type: GraphQLBoolean
            }
        }
    });

    const fieldMetadataType = new GraphQLObjectType({
        name: EXTENDED_INTROSPECTION_TYPE_NAMES.fieldMetadata,
        description: 'Metadata on a GraphQL field',
        fields: {
            link: {
                description: 'Specifies if this field should be resolved as a link to a different field',
                type: linkType
            },
            join: {
                description: 'Specifies if and how filters, ordering and limiting of a linked child field should be joined into this field',
                type: joinType
            }
        }
    });

    const fieldType = new GraphQLObjectType({
        name: EXTENDED_INTROSPECTION_TYPE_NAMES.field,
        description: 'Extension of the field introspection type',
        fields: {
            name: {
                description: 'The field name',
                type: GraphQLString
            },

            metadata: {
                description: 'Additional metadata on this field',
                type: fieldMetadataType
            },
        }
    });

    const typeType = new GraphQLObjectType({
        name: EXTENDED_INTROSPECTION_TYPE_NAMES.type,
        description: 'Extension of the type introspection type',
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
        name: EXTENDED_INTROSPECTION_TYPE_NAMES.introspection,
        description: 'Offers non-standard type information',
        fields: {
            types: {
                description: 'A list of all types that have extended information',
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(typeType)))
            }
        }
    });
}
