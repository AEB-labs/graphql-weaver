import { GraphQLField, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { ExtendedIntrospectionQuery } from './extended-introspection';

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

export class ExtendedSchema {
    constructor(public readonly schema: GraphQLSchema, public readonly fieldMetadata: Map<string, FieldMetadata>) {
    }

    // maybe move this to extended-introspection.ts (buildExtendedClientSchema?) to avoid cyclic references
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
