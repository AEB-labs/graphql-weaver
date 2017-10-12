import { GraphQLField, GraphQLObjectType, GraphQLSchema } from 'graphql';

export interface FieldMetadata {
    link?: LinkConfig
    join?: JoinConfig
}

export interface LinkConfig {
    field: string
    argument: string
    batchMode: boolean
    keyField?: string
    ignore?: boolean
    oneToMany?: boolean
    /**
     * If specified, a new field with this name will be added with the target type. If not specified, the annotated field will be replaced with the link field.
     */
    linkFieldName?: string
}

export interface JoinConfig {
    linkField: string
    ignore?: boolean
}

/**
 * Holds metadata of a GraphQLSchema
 */
export class SchemaMetadata {
    public readonly fieldMetadata = new Map<string, FieldMetadata>();

    public constructor(config: { fieldMetadata?: Map<string, FieldMetadata> } = {}) {
        this.fieldMetadata = config.fieldMetadata || this.fieldMetadata;
    }

    getFieldMetadata(type: string | GraphQLObjectType, field: string | GraphQLField<any, any>) {
        if (typeof type != 'string') {
            type = type.name;
        }
        if (typeof field != 'string') {
            field = field.name;
        }
        return this.fieldMetadata.get(SchemaMetadata.getFieldKey(type, field));
    }

    private static getFieldKey(type: string, field: string) {
        return `${type}.${field}`;
    }
}

export class ExtendedSchema {
    constructor(public readonly schema: GraphQLSchema, public readonly metadata: SchemaMetadata = new SchemaMetadata()) {
    }

    getFieldMetadata(type: string | GraphQLObjectType, field: string | GraphQLField<any, any>) {
        return this.metadata.getFieldMetadata(type, field);
    }

    withSchema(schema: GraphQLSchema) {
        return new ExtendedSchema(schema, this.metadata);
    }

    withMetadata(metadata: SchemaMetadata) {
        return new ExtendedSchema(this.schema, metadata);
    }

    withFieldMetadata(fieldMetadata: Map<string, FieldMetadata>) {
        return new ExtendedSchema(this.schema, new SchemaMetadata({...this.metadata, fieldMetadata}));
    }

    public get fieldMetadata() {
        return this.metadata.fieldMetadata;
    }
}
