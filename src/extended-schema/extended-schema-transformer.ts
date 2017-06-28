import { ExtendedSchema, FieldMetadata } from './extended-schema';
import {
    FieldsTransformationContext, FieldTransformationContext, GraphQLNamedFieldConfig, SchemaTransformationContext,
    SchemaTransformer, transformSchema
} from '../graphql/schema-transformer';
import { GraphQLFieldConfig, GraphQLFieldConfigMap, GraphQLObjectType } from 'graphql';
import { mapValues } from '../utils/utils';

type TransformationFunction<TConfig, TContext extends SchemaTransformationContext>
    = (config: TConfig, context: TContext) => TConfig;

export interface GraphQLNamedFieldConfigWithMetadata<TSource = any, TContext = any> extends GraphQLNamedFieldConfig<TSource, TContext> {
    metadata?: FieldMetadata;
}

export interface GraphQLFieldConfigWithMetadata<TSource = any, TContext = any> extends GraphQLFieldConfig<TSource, TContext> {
    metadata?: FieldMetadata;
}

type GraphQLFieldConfigMapWithMetadata<TSource = any, TContext = any> = { [name: string]: GraphQLFieldConfigWithMetadata<TSource, TContext> };

export interface ExtendedSchemaTransformer extends SchemaTransformer {
    transformField?: TransformationFunction<GraphQLNamedFieldConfigWithMetadata<any, any>, FieldTransformationContext>;
    transformFields?: TransformationFunction<GraphQLFieldConfigMapWithMetadata<any, any>, FieldsTransformationContext>;
}

// do everything as if fieldMetadata was a property of Field / FieldConfig
// transformObjectType: no action required
// transformField: get metadata via old type -> call (if defined) -> store metadata with new key (type + field)
// transformFields (if defined): get and delete all metadata via new type + new field names -> call -> store all metadata

/**
 * Transforms an ExtendedSchema via transformation functions for the schema elements
 *
 * This makes it seem as if fieldMetadata was a property of GraphQLField / GraphQLFieldConfig - it can be modified in
 * transformField() and transformFields(). Fields can even be added or removed in transformFields(). As long as the
 * metadata property is carried around properly, everything should work as expected.
 *
 * @param schema
 * @param transformer
 * @returns {any}
 */
export function transformExtendedSchema(schema: ExtendedSchema, transformer: ExtendedSchemaTransformer) {
    // This is a bit of an ugly data structure because it changes over time
    // At the beginning, it is empty
    // After transformField() is called for all fields of a type, it contains the *new* metadata map with new type names,
    //   new field names and new metadata values.
    // If transformFields() is defined, for each type, the metadata keys are first removed completely (and passed to
    //   transformFields), then re-added properly with the even newer field names and metadata values
    const fieldMetadata = new Map<string, FieldMetadata>();

    // not using methods in here to work around https://github.com/Microsoft/TypeScript/issues/16765
    const regularTransformer = {
        ...transformer,

        transformField: (config: GraphQLNamedFieldConfig<any, any>, context: FieldTransformationContext) => {
            // non-object (interface) fields have no metadata
            const type = context.oldOuterType;
            if (!(type instanceof GraphQLObjectType)) {
                if (transformer.transformField) {
                    return transformer.transformField(config, context);
                } else {
                    return config;
                }
            }

            // for object types, we need to do this even if the transformField method is not defined, just to do the
            // potential *type* renaming

            // enrich with metadata, using old type and field because we use the schema's metadata store
            let extendedConfig: GraphQLNamedFieldConfigWithMetadata = {
                ...config,
                metadata: schema.getFieldMetadata(type, context.oldField)
            };

            // if there is a transformer, call it
            if (transformer.transformField) {
                extendedConfig = transformer.transformField(extendedConfig, context);
            }

            // Now, if there is (still) metadata, set it in the new store with new type and field name
            if (extendedConfig.metadata) {
                fieldMetadata.set(`${context.newOuterType.name}.${extendedConfig.name}`, extendedConfig.metadata);
            }

            // Do the "normal" transformation, but strip out metadata
            const {metadata, ...regularConfig} = extendedConfig;
            return regularConfig;
        },

        transformFields: (config: GraphQLFieldConfigMap<any, any>, context: FieldsTransformationContext) => {
            // If transformFields is not defined, we don't need to do anything
            const fn = transformer.transformFields;
            if (!fn) {
                return config;
            }

            // non-object (interface) fields have no metadata
            const type = context.oldOuterType;
            if (!(type instanceof GraphQLObjectType)) {
                return fn(config, context);
            }

            // Enrich config with metadata values from new metadata store, but delete them from the store
            // because we will add all the even-newer metadata later
            let extendedConfig: GraphQLFieldConfigMapWithMetadata = mapValues(config, (config, fieldName) => {
                const key = `${context.newOuterType}.${fieldName}`;
                const metadata = fieldMetadata.get(key);
                fieldMetadata.delete(key);
                return {...config, metadata};
            });

            // call the transformer
            const result = fn(extendedConfig, context);

            // Now, store the even-newer metadata and strip the metadata property from the config
            const regularResult = mapValues(result, ({metadata, ...regularConfig}, fieldName) => {
                if (metadata) {
                    const key = `${context.newOuterType}.${fieldName}`;
                    fieldMetadata.set(key, metadata);
                }
                return regularConfig;
            });

            // do the regular transform
            return regularResult;
        }
    };

    const newSchema = transformSchema(schema.schema, regularTransformer);
    return new ExtendedSchema(newSchema, fieldMetadata);
}
