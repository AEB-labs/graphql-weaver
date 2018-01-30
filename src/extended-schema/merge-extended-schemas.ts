import { ExtendedSchema, FieldMetadata, SchemaMetadata } from './extended-schema';
import { flatMap } from '../utils/utils';
import { mergeSchemas } from '../graphql/merge-schemas';

/**
 * Merges multiple GraphQL schemas by merging the fields of root types (query, mutation, subscription).
 * Also takes care of extended field metadata
 */
export function mergeExtendedSchemas(...schemas: ExtendedSchema[]) {
    const fieldMetadata = mergeFieldMetadata(...schemas.map(schema => schema.fieldMetadata));
    return new ExtendedSchema(mergeSchemas(schemas.map(schema => schema.schema)), new SchemaMetadata({fieldMetadata}));
}

export function mergeFieldMetadata(...metadatas: Map<string, FieldMetadata>[]) {
    return new Map<string, FieldMetadata>(flatMap(metadatas, map => Array.from(map)));
}
