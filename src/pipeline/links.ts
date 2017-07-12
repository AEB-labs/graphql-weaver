import {
    ASTNode,
    FieldNode,
    getNamedType,
    GraphQLList,
    GraphQLObjectType,
    GraphQLOutputType,
    GraphQLResolveInfo,
    GraphQLScalarType,
    TypeInfo,
    visit,
    visitWithTypeInfo
} from "graphql";
import {PipelineModule} from "./pipeline-module";
import {ExtendedSchema} from "../extended-schema/extended-schema";
import {
    ExtendedSchemaTransformer,
    GraphQLNamedFieldConfigWithMetadata,
    transformExtendedSchema
} from "../extended-schema/extended-schema-transformer";
import {FieldTransformationContext} from "../graphql/schema-transformer";
import {throwError} from "../utils/utils";
import {ArrayKeyWeakMap} from "../utils/multi-key-weak-map";
import {fetchLinkedObjects, parseLinkTargetPath} from "./helpers/link-helpers";
import {isListType} from "../graphql/schema-utils";
import DataLoader = require('dataloader');

/**
 * Adds a feature to link fields to types of other endpoints
 */
export class LinksModule implements PipelineModule {
    private unlinkedSchema: ExtendedSchema | undefined;
    private linkedSchema: ExtendedSchema | undefined;

    transformExtendedSchema(schema: ExtendedSchema): ExtendedSchema {
        this.unlinkedSchema = schema;
        this.linkedSchema = transformExtendedSchema(schema, new SchemaLinkTransformer(schema));
        return this.linkedSchema!;
    }

    // does not work because we currently need the schema
    /*getSchemaTransformer() {
     return new SchemaLinkTransformer(this.config);
     }*/

    /**
     * Replaces linked fields by scalar fields
     *
     * The resolver of the linked field will do the fetch of the linked object, so here we just need the scalar value
     */
    transformNode(node: ASTNode): ASTNode {
        if (!this.linkedSchema || !this.unlinkedSchema) {
            throw new Error(`Schema is not built yet`);
        }

        let layer = 0;
        const typeInfo = new TypeInfo(this.linkedSchema.schema);

        // first-level fields would be nested calls, there we want the link data
        const ignoreFirstLayer = node.kind != 'FragmentDefinition';

        return visit(node, visitWithTypeInfo(typeInfo, {
            Field: {
                enter: (child: FieldNode) => {
                    if (ignoreFirstLayer && layer < 2) {
                        layer++;
                        return;
                    }
                    layer++;
                    const type = typeInfo.getParentType();
                    if (!type || !(type instanceof GraphQLObjectType)) {
                        throw new Error(`Failed to retrieve type for field ${child.name.value}`);
                    }
                    const metadata = this.unlinkedSchema!.getFieldMetadata(type, typeInfo.getFieldDef());
                    if (metadata && metadata.link) {
                        return {
                            ...child,
                            selectionSet: undefined
                        };
                    }
                    return undefined;
                },

                leave() {
                    layer--;
                }
            }
        }));
    }
}

class SchemaLinkTransformer implements ExtendedSchemaTransformer {
    constructor(private readonly schema: ExtendedSchema) {

    }

    transformField(config: GraphQLNamedFieldConfigWithMetadata<any, any>, context: FieldTransformationContext): GraphQLNamedFieldConfigWithMetadata<any, any> {
        if (!config.metadata || !config.metadata.link) {
            return config;
        }
        const unlinkedSchema = this.schema.schema;
        const linkConfig = config.metadata.link;
        const {fieldPath: targetFieldPath, field: targetField} = parseLinkTargetPath(linkConfig.field, this.schema.schema) ||
            throwError(`Link on ${context.oldOuterType}.${config.name} defines target field as ${linkConfig.field} which does not exist in the schema`);

        const isListMode = isListType(config.type);

        // unwrap list for batch mode, unwrap NonNull because object may be missing -> strip all type wrappers
        const targetRawType = <GraphQLOutputType>getNamedType(context.mapType(targetField.type));
        const sourceRawType = getNamedType(context.mapType(config.type));
        if (!(sourceRawType instanceof GraphQLScalarType)) {
            throw new Error(`Type of @link field must be scalar type or list/non-null type of scalar type`);
        }
        const keyType: GraphQLScalarType = sourceRawType;

        const dataLoaders = new ArrayKeyWeakMap<FieldNode | any, DataLoader<any, any>>();

        /**
         * Fetches an object by its key, but collects keys before sending a batch request
         */
        async function fetchDeferred(key: any, info: GraphQLResolveInfo & { context: any }) {
            // the fieldNodes array is unique each call, but each individual fieldNode is reused). We can not easily
            // merge the selection sets because they may have collisions. However, we could merge all queries to one
            // endpoint (dataLoader over dataLoaders).
            // also include context because it is also used
            const dataLoaderKey = [...info.fieldNodes, context];
            let dataLoader = dataLoaders.get(dataLoaderKey);
            if (!dataLoader) {
                dataLoader = new DataLoader(keys => fetchLinkedObjects({
                    keys, info, unlinkedSchema, keyType, linkConfig
                }));
                dataLoaders.set(dataLoaderKey, dataLoader);
            }

            return dataLoader.load(key);
        }

        return {
            ...config,
            resolve: async (source, vars, context, info) => {
                const fieldNode = info.fieldNodes[0];
                const alias = fieldNode.alias ? fieldNode.alias.value : fieldNode.name.value;
                const keyOrKeys = source[alias];
                if (!keyOrKeys) {
                    return keyOrKeys;
                }

                const extendedInfo = {...info, context};
                if (isListMode) {
                    const keys: any[] = keyOrKeys;
                    return Promise.all(keys.map(key => fetchDeferred(key, extendedInfo)));
                } else {
                    const key = keyOrKeys;
                    return fetchDeferred(key, extendedInfo);
                }
            },
            type: isListMode ? new GraphQLList(targetRawType) : targetRawType
        };
    }

}
