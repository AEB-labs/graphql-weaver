import { GraphQLField, GraphQLObjectType, GraphQLSchema } from 'graphql';

export interface FieldMetadata {
    readonly link?: LinkConfig
    readonly join?: JoinConfig
}

export interface LinkConfig {
    /**
     * The field name on the target type that will be used to populate the link.
     * 
     * @type {string}
     * @memberof LinkConfig
     */
    readonly field: string
    /**
     * The argument to use when requesting data from the target field.
     * 
     * @type {string}
     * @memberof LinkConfig
     */
    readonly argument: string
    /**
     * When requesting mutiple items from a target field that supports an argument list set batchMode to "true" to submit all argument values in a single batch.
     * 
     * @type {boolean}
     * @memberof LinkConfig
     */
    readonly batchMode: boolean
    /**
     * When using batchMode, you can set this to a field in the target type which will be compared against the key values to match target objects to the link locations. If omitted, the elements returned by the target fields are assumed to be in the same order as the keys given as argument value.
     * 
     * @type {string}
     * @memberof LinkConfig
     */
    readonly keyField?: string
    /**
     * Disables the processing of this metaData. No links will be produced in the weaved schema.
     * 
     * @type {boolean}
     * @memberof LinkConfig
     */
    readonly ignore?: boolean
    /**
     * Set to "true" to link this field to multiple target objects. The target field should accept one key as an argument and return a list of items. A linkFieldName is required to create a virtual field to contain the linked data. This cannot be combined with batchMode.
     * 
     * @type {boolean}
     * @memberof LinkConfig
     */
    readonly oneToMany?: boolean
    /**
     * If specified, a new field with this name will be added with the target type. If not specified, the annotated field will be replaced with the link field. If creating a one-to-many link, this is required to create a virtual field to contain the linked list of data.
     * 
     * @type {string}
     * @memberof LinkConfig
     */
    readonly linkFieldName?: string
}

export interface JoinConfig {
    readonly linkField: string
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
