import {
    GraphQLBoolean, GraphQLField, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString
} from 'graphql';
import { objectValues } from '../utils';

export const EXTENDED_INTROSPECTION_FIELD = '_extIntrospection';

export interface ExtendedIntrospectionQuery {
    _extIntrospection: {
        types: {
            name: string,
            fields: Array<FieldMetadata & {
                name: string,
            }>
        }[]
    }
}

export interface FieldMetadata {
    link?: LinkTargetConfig
}

export interface LinkTargetConfig {
    endpoint: string
    field: string
    argument: string
    batchMode: boolean
    keyField?: string
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

export const EMPTY_INTROSPECTION_QUERY: ExtendedIntrospectionQuery = {_extIntrospection: {types: []}};

export function supportsExtendedIntrospection(schema: GraphQLSchema) {
    return EXTENDED_INTROSPECTION_FIELD in schema.getQueryType().getFields();
}

export class ExtendedSchema {
    constructor(public readonly schema: GraphQLSchema, public readonly fieldMetadata: Map<string, FieldMetadata>) {
    }

    static fromIntrospection(schema: GraphQLSchema, extendedIntrospection: ExtendedIntrospectionQuery) {
        const map = new Map<string, FieldMetadata>();
        for (const type of extendedIntrospection._extIntrospection.types) {
            for (const field of type.fields) {
                const {name, ...metadata} = field;
                map.set(this.getFieldKey(type.name, field.name), field);
            }
        }
        return new ExtendedSchema(schema, map);
    }

    static fromSchema(schema: GraphQLSchema) {
        return new ExtendedSchema(schema, new Map());
    }

    getFieldMetadata(type: string | GraphQLObjectType, field: string | GraphQLField<any, any>) {
        if (typeof type != 'string') {
            type = type.name;
        }
        if (typeof field != 'string') {
            field = field.name;
        }
        return this.fieldMetadata.get(ExtendedSchema.getFieldKey(type, field));
    }

    withSchema(schema: GraphQLSchema) {
        return new ExtendedSchema(schema, this.fieldMetadata);
    }

    withFieldMetadata(fieldMetadata: Map<string, FieldMetadata>) {
        return new ExtendedSchema(this.schema, fieldMetadata);
    }

    private static getFieldKey(type: string, field: string) {
        return `${type}.${field}`;
    }
}

let extendedIntrospectionType: GraphQLObjectType | undefined;
export function getExtendedIntrospectionType(): GraphQLObjectType {
    if (!extendedIntrospectionType) {
        extendedIntrospectionType = createExtendedIntrospectionType();
    }
    return extendedIntrospectionType;
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
                type: GraphQLString,
                resolve: ({type}: { type: GraphQLObjectType }) => type.name
            },

            fields: {
                description: 'A list of all fields of this type that have extended information',
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(fieldType))),
                resolve: ({type, schema}: { type: GraphQLObjectType, schema: ExtendedSchema }) =>
                    objectValues(type.getFields())
                        .map(field => ({field, metadata: schema.getFieldMetadata(type, field)})) // fetch metadata
                        .filter(({metadata}) => metadata) // discard fields without metadata
                        .map(({field, metadata}) => ({...metadata, name: field.name})) // unwrap
            }
        }
    });

    function typeHasMetadata(type: GraphQLObjectType, schema: ExtendedSchema) {
        // TODO maybe optimize this with a set?
        return Array.from(schema.fieldMetadata.keys()).some(key => key.startsWith(type.name + '.'));
    }

    return new GraphQLObjectType({
        name: '_ExtendedIntrospection',
        description: 'Offers non-standard type information',
        fields: {
            types: {
                description: 'A list of all types that have extended information',
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(typeType))),
                resolve: (schema: ExtendedSchema) => objectValues(schema.schema.getTypeMap())
                    .filter(type => type instanceof GraphQLObjectType)
                    .filter(type => typeHasMetadata(type, schema))
                    .map(type => ({type, schema}))
            }
        }
    });
}
