import { ExtendedSchema } from '../endpoints/extended-introspection';
import {
    combineTransformers, FieldTransformationContext, GraphQLNamedFieldConfig, SchemaTransformer, transformSchema
} from './schema-transformer';
import { GraphQLObjectType, GraphQLObjectTypeConfig } from 'graphql';
import { mapMapKeys } from '../utils';

class RenameRecognizingTransformer implements SchemaTransformer {
    private readonly typeMap = new Map<string, string>();
    private readonly fieldMap = new Map<string, string>(); // oldType.oldField => newField

    transformObjectType(config: GraphQLObjectTypeConfig<any, any>, {oldType}: { oldType: GraphQLObjectType }) {
        this.typeMap.set(oldType.name, config.name);
        return config;
    }

    transformField(config: GraphQLNamedFieldConfig<any, any>, {oldField, oldOuterType}: FieldTransformationContext) {
        this.typeMap.set(this.getFieldKey(oldOuterType.name, oldField.name), config.name);
    }

    getNewFieldKey(key: string): string {
        const [oldType, oldField] = key.split('.');
        if (!oldType || !oldField) {
            console.warn(`Field metadata key ${key} does not follow the type.field pattern`);
            return key;
        }
        const newTypeName = this.typeMap.get(oldType);
        const newFieldName = this.typeMap.get(this.getFieldKey(oldType, oldField));
        if (!newTypeName || !newFieldName) {
            console.warn(`Field metadata key ${key} does does not exist in schema`);
            return key;
        }
        return this.getFieldKey(newTypeName, newFieldName);
    }

    private getFieldKey(type: string, field: string) {
        return `${type}.${field}`;
    }
}

export function transformExtendedSchema(schema: ExtendedSchema, transformer: SchemaTransformer) {
    const renameRecognizingTransformer = new RenameRecognizingTransformer();
    const newSchema = transformSchema(schema.schema, combineTransformers(transformer, renameRecognizingTransformer));
    const newFieldMetadata = mapMapKeys(schema.fieldMetadata, key => renameRecognizingTransformer.getNewFieldKey(key));
    return new ExtendedSchema(newSchema, newFieldMetadata);
}
