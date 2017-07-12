import {
    DocumentNode, execute,
    FieldNode, GraphQLField, GraphQLList, GraphQLNonNull, GraphQLResolveInfo, GraphQLScalarType,
    GraphQLSchema, OperationDefinitionNode, SelectionSetNode
} from 'graphql';
import {getNonNullType, walkFields} from '../../graphql/schema-utils';
import {LinkConfig} from "../../extended-schema/extended-schema";
import {arrayToObject, throwError} from "../../utils/utils";
import {getFieldAsQueryParts} from "../../graphql/field-as-query";
import {
    addFieldSelectionSafely, addVariableDefinitionSafely, createFieldNode,
    createNestedArgumentWithVariableNode, createSelectionChain
} from "../../graphql/language-utils"
import {isArray} from "util";
import {assertSuccessfulResponse} from "../../endpoints/client";

export function parseLinkTargetPath(path: string, schema: GraphQLSchema): { field: GraphQLField<any, any>, fieldPath: string[] } | undefined {
    const fieldPath = path.split('.');
    const field = walkFields(schema.getQueryType(), fieldPath);
    if (!field) {
        return undefined;
    }
    return {field, fieldPath};
}

/**
 * Fetches a list of objects by their keys
 *
 * @param params.keys an array of key values
 * @param params.info the resolve info that specifies the structure of the query
 * @return an array of objects, with 1:1 mapping to the keys
 */
export async function fetchLinkedObjects(params: {
    keys: any[],
    keyType: GraphQLScalarType,
    linkConfig: LinkConfig,
    unlinkedSchema: GraphQLSchema,
    info: GraphQLResolveInfo & { context: any }
}) {
    const {unlinkedSchema, keys, keyType, linkConfig, info} = params;

    const {fieldPath: targetFieldPath, field: targetField} = parseLinkTargetPath(linkConfig.field, unlinkedSchema) ||
    throwError(`Link target field as ${linkConfig.field} which does not exist in the schema`);

    /**
     * Fetches one object, or a list of objects in batch mode, according to the query underlying the resolveInfo
     * @param keyOrKeys either a single key of a list of keys, depending on link.batchMode
     * @param resolveInfo the resolveInfo from the request
     * @returns {Promise<void>}
     */
    async function fetchSingularOrPlural(keyOrKeys: any, resolveInfo: GraphQLResolveInfo & { context: any }) {
        const {fragments, ...originalParts} = getFieldAsQueryParts(resolveInfo);

        // add variable
        const varType = linkConfig.batchMode ? new GraphQLNonNull(new GraphQLList(getNonNullType(keyType))) : getNonNullType(keyType);
        const varNameBase = linkConfig.argument.split('.').pop()!;
        const {variableDefinitions, name: varName} = addVariableDefinitionSafely(originalParts.variableDefinitions, varNameBase, varType);
        const variableValues = {
            ...originalParts.variableValues,
            [varName]: keyOrKeys
        };

        // add keyField if needed
        let payloadSelectionSet = originalParts.selectionSet;
        let keyFieldAlias: string | undefined;
        if (linkConfig.batchMode && linkConfig.keyField) {
            const {alias, selectionSet: newSelectionSet} =
                addFieldSelectionSafely(payloadSelectionSet, linkConfig.keyField, arrayToObject(fragments, f => f.name.value));
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
                createNestedArgumentWithVariableNode(linkConfig.argument, varName)
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
        const result = await execute(unlinkedSchema, document, {} /* root */, resolveInfo.context, variableValues);
        assertSuccessfulResponse(result);

        // unwrap
        const data = targetFieldPath.reduce((data, fieldName) => data![fieldName], result.data);

        // unordered case: endpoints does not preserve order, so we need to remap based on a key field
        if (linkConfig.batchMode && linkConfig.keyField) {
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

    if (!linkConfig.batchMode) {
        // no batch mode, so do one request per id
        return keys.map(key => fetchSingularOrPlural(key, info));
    }
    return await fetchSingularOrPlural(keys, info);
}