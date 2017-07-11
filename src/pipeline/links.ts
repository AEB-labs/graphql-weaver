import {
    ASTNode, DocumentNode, execute, FieldNode, getNamedType, GraphQLList, GraphQLNonNull, GraphQLObjectType,
    GraphQLOutputType, GraphQLResolveInfo, GraphQLType, OperationDefinitionNode, SelectionSetNode, TypeInfo, visit,
    visitWithTypeInfo
} from 'graphql';
import { PipelineModule } from './pipeline-module';
import { ExtendedSchema } from '../extended-schema/extended-schema';
import {
    ExtendedSchemaTransformer, GraphQLNamedFieldConfigWithMetadata, transformExtendedSchema
} from '../extended-schema/extended-schema-transformer';
import { FieldTransformationContext } from '../graphql/schema-transformer';
import { getFieldAsQueryParts } from '../graphql/field-as-query';
import {
    addFieldSelectionSafely, addVariableDefinitionSafely, createFieldNode, createNestedArgumentWithVariableNode,
    createSelectionChain
} from '../graphql/language-utils';
import { arrayToObject, throwError } from '../utils/utils';
import { assertSuccessfulResponse } from '../endpoints/client';
import { isArray } from 'util';
import { ArrayKeyWeakMap } from '../utils/multi-key-weak-map';
import { parseLinkTargetPath } from './helpers/link-helpers';
import DataLoader = require('dataloader');
import { isListType } from '../graphql/schema-utils';

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

function getNonNullType<T extends GraphQLType>(type: T | GraphQLNonNull<T>): GraphQLNonNull<T> {
    if (type instanceof GraphQLNonNull) {
        return type;
    }
    return new GraphQLNonNull(type);
}

class SchemaLinkTransformer implements ExtendedSchemaTransformer {
    constructor(private readonly schema: ExtendedSchema) {

    }

    transformField(config: GraphQLNamedFieldConfigWithMetadata<any, any>, context: FieldTransformationContext): GraphQLNamedFieldConfigWithMetadata<any, any> {
        if (!config.metadata || !config.metadata.link) {
            return config;
        }
        const schema = this.schema.schema;
        const link = config.metadata.link;
        const {fieldPath: targetFieldPath, field: targetField} = parseLinkTargetPath(link.field, this.schema.schema) ||
            throwError(`Link on ${context.oldOuterType}.${config.name} defines target field as ${link.field} which does not exist in the schema`);

        const isListMode = isListType(config.type);

        // unwrap list for batch mode, unwrap NonNull because object may be missing -> strip all type wrappers
        const targetRawType = <GraphQLOutputType>getNamedType(context.mapType(targetField.type));
        const sourceRawType = getNamedType(context.mapType(config.type));

        /**
         * Fetches one object, or a list of objects in batch mode, according to the query underlying the resolveInfo
         * @param keyOrKeys either a single key of a list of keys, depending on link.batchMode
         * @param resolveInfo the resolveInfo from the request
         * @returns {Promise<void>}
         */
        async function fetchSingularOrPlural(keyOrKeys: any, resolveInfo: GraphQLResolveInfo & { context: any }) {
            const {fragments, ...originalParts} = getFieldAsQueryParts(resolveInfo);

            // add variable
            const varType = link.batchMode ? new GraphQLNonNull(new GraphQLList(getNonNullType(sourceRawType))) : getNonNullType(sourceRawType);
            const varNameBase = link.argument.split('.').pop()!;
            const {variableDefinitions, name: varName} = addVariableDefinitionSafely(originalParts.variableDefinitions, varNameBase, varType);
            const variableValues = {
                ...originalParts.variableValues,
                [varName]: keyOrKeys
            };

            // add keyField if needed
            let payloadSelectionSet = originalParts.selectionSet;
            let keyFieldAlias: string | undefined;
            if (link.batchMode && link.keyField) {
                const {alias, selectionSet: newSelectionSet} =
                    addFieldSelectionSafely(payloadSelectionSet, link.keyField, arrayToObject(fragments, f => f.name.value));
                keyFieldAlias = alias;
                payloadSelectionSet = newSelectionSet;
            }

            // wrap selection in field node chain on target, and add the argument with the key field
            const outerFieldNames = [...targetFieldPath];
            const innerFieldName = outerFieldNames.pop()!; // this removes the last element of outerFields in-place
            const innerFieldNode: FieldNode = {
                ...createFieldNode(innerFieldName),
                selectionSet: payloadSelectionSet,
                arguments: [
                    createNestedArgumentWithVariableNode(link.argument, varName)
                ]
            };
            const innerSelectionSet: SelectionSetNode = {
                kind: 'SelectionSet',
                selections: [innerFieldNode]
            };
            const selectionSet = createSelectionChain(outerFieldNames, innerSelectionSet);

            // create document
            const operation: OperationDefinitionNode = {
                kind: 'OperationDefinition',
                operation: 'query',
                variableDefinitions,
                selectionSet
            };
            const document: DocumentNode = {
                kind: 'Document',
                definitions: [
                    operation,
                    ...fragments
                ]
            };

            // execute
            const result = await execute(schema, document, {} /* root */, resolveInfo.context, variableValues);
            assertSuccessfulResponse(result);

            // unwrap
            const data = targetFieldPath.reduce((data, fieldName) => data![fieldName], result.data);

            // unordered case: endpoints does not preserve order, so we need to remap based on a key field
            if (link.batchMode && link.keyField) {
                // first, create a lookup table from id to item
                if (!isArray(data)) {
                    throw new Error(`Result of ${targetFieldPath.join('.')} expected to be an array because batchMode is true`);
                }
                const map = new Map((<any[]>data).map(item => <[any, any]>[item[keyFieldAlias!], item]));
                // Then, use the lookup table to efficiently order the result
                return (keyOrKeys as any[]).map(key => map.get(key));
            }

            // ordered case (plural) or singular case
            return data;
        }

        /**
         * Fetches a list of objects by their keys
         *
         * @param keys an array of key values
         * @param info the resolve info that specifies the structure of the query
         * @return an array of objects, with 1:1 mapping to the keys
         */
        async function fetchBatch(keys: any[], info: GraphQLResolveInfo & { context: any }) {
            if (!link.batchMode) {
                // no batch mode, so do one request per id
                return keys.map(key => fetchSingularOrPlural(key, info));
            }
            return await fetchSingularOrPlural(keys, info);
        }

        const dataLoaders = new ArrayKeyWeakMap<FieldNode|any, DataLoader<any, any>>();

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
                dataLoader = new DataLoader(keys => fetchBatch(keys, info));
                dataLoaders.set(dataLoaderKey, dataLoader);
            }

            return dataLoader.load(key);
        }

        return {
            ...config,
            resolve: async (source, vars, context, info) => {
                const fieldNode = info.fieldNodes[0];
                const alias = fieldNode.alias ? fieldNode.alias.value : fieldNode.name.value;
                const key = source[alias];
                if (!key) {
                    return key;
                }
                return isListMode ? fetchBatch(key, {...info, context}) : fetchDeferred(key, {...info, context})
            },
            type: isListMode ? new GraphQLList(targetRawType) : targetRawType
        };
    }

}
