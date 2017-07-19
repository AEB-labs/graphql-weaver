import {
    DocumentNode,
    FieldNode, getNamedType, GraphQLEnumType, GraphQLEnumValue, GraphQLField, GraphQLFieldConfigArgumentMap,
    GraphQLInputFieldConfigMap, GraphQLInputObjectType, GraphQLInputType, GraphQLInterfaceType, GraphQLList,
    GraphQLObjectType, GraphQLOutputType, GraphQLResolveInfo, GraphQLScalarType, OperationDefinitionNode, TypeInfo,
    ValueNode, visit, visitWithTypeInfo
} from 'graphql';
import { PipelineModule } from './pipeline-module';
import { ExtendedSchema, JoinConfig, LinkConfig } from '../extended-schema/extended-schema';
import {
    ExtendedSchemaTransformer, GraphQLNamedFieldConfigWithMetadata, transformExtendedSchema
} from '../extended-schema/extended-schema-transformer';
import { FieldTransformationContext } from '../graphql/schema-transformer';
import { arrayToObject, flatMap, groupBy, throwError } from '../utils/utils';
import { ArrayKeyWeakMap } from '../utils/multi-key-weak-map';
import {
    fetchJoinedObjects, fetchLinkedObjects, FILTER_ARG, FIRST_ARG, ORDER_BY_ARG, parseLinkTargetPath
} from './helpers/link-helpers';
import { isListType } from '../graphql/schema-utils';
import { Query } from '../graphql/common';
import { dropUnusedFragments, dropUnusedVariables, SlimGraphQLResolveInfo } from '../graphql/field-as-query';
import {
    addVariableDefinitionSafely, createFieldNode, expandSelections, getAliasOrName
} from '../graphql/language-utils';
import DataLoader = require('dataloader');

const JOIN_ALIAS = '_joined'; // used when a joined field is not selected

/**
 * Adds a feature to link fields to types of other endpoints
 */
export class LinksModule implements PipelineModule {
    private unlinkedSchema: ExtendedSchema | undefined;
    private linkedSchema: ExtendedSchema | undefined;
    private transformationInfo: SchemaTransformationInfo | undefined;

    transformExtendedSchema(schema: ExtendedSchema): ExtendedSchema {
        this.unlinkedSchema = schema;
        const transformer = new SchemaLinkTransformer(schema);
        this.linkedSchema = transformExtendedSchema(schema, transformer);
        this.transformationInfo = transformer.transformationInfo;
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
    transformQuery(query: Query): Query {
        if (!this.linkedSchema || !this.unlinkedSchema) {
            throw new Error(`Schema is not built yet`);
        }

        const typeInfo = new TypeInfo(this.linkedSchema.schema);
        let variableValues = query.variableValues;
        const operation = <OperationDefinitionNode | undefined>query.document.definitions.filter(def => def.kind == 'OperationDefinition')[0];
        if (!operation) {
            throw new Error(`Operation not found`);
        }
        let variableDefinitions = operation.variableDefinitions || [];

        type FieldStackEntry = { joinConfig?: JoinConfig, isLinkFieldSelectedYet?: boolean };
        let fieldStack: FieldStackEntry[] = [];

        let document: DocumentNode = visit(query.document, visitWithTypeInfo(typeInfo, {
            Field: {
                enter: (child: FieldNode) => {
                    const fieldStackOuter = fieldStack[fieldStack.length - 1];
                    const fieldStackTop: FieldStackEntry = {};
                    fieldStack.push(fieldStackTop);

                    const parentType = typeInfo.getParentType();
                    if (!parentType) {
                        throw new Error(`Failed to retrieve parent type for field ${child.name.value}`);
                    }
                    if (!(parentType instanceof GraphQLObjectType)) {
                        // field metadata only exists on object types
                        return undefined;
                    }
                    const metadata = this.unlinkedSchema!.getFieldMetadata(parentType, typeInfo.getFieldDef());

                    if (metadata && metadata.link) {
                        if (fieldStackOuter && fieldStackOuter.joinConfig && fieldStackOuter.joinConfig.linkField == child.name.value) {
                            fieldStackOuter.isLinkFieldSelectedYet = true;
                        }

                        child = {
                            ...child,
                            selectionSet: undefined
                        };
                    }

                    if (metadata && metadata.join) {
                        fieldStackTop.joinConfig = metadata.join;
                        fieldStackTop.isLinkFieldSelectedYet = false;
                        const transformationInfo = this.transformationInfo!.getJoinTransformationInfo(parentType.name, typeInfo.getFieldDef().name);
                        if (!transformationInfo) {
                            throw new Error(`Missing joinTransformationInfo`);
                        }

                        let hasRightFilter = false;

                        // remove right filter
                        const filterArg = (child.arguments || []).filter(arg => arg.name.value == FILTER_ARG)[0];
                        const rightFilterFieldName = metadata.join.linkField;
                        if (filterArg) {
                            const leftFilterType = transformationInfo.leftFilterArgType;

                            // first, remove the joined filter arg
                            child = {
                                ...child,
                                arguments: child.arguments!.filter(arg => arg != filterArg)
                            };

                            // now see if we need the filter arg for the left field again
                            if (leftFilterType) {
                                let newValue: ValueNode;
                                switch (filterArg.value.kind) {
                                    case 'Variable':
                                        const value = variableValues[filterArg.value.name.value];
                                        hasRightFilter = rightFilterFieldName in value;
                                        const valueWithoutRightFilter = {...value, [rightFilterFieldName]: undefined};
                                        const {name: varName, variableDefinitions: newVariableDefinitions} =
                                            addVariableDefinitionSafely(variableDefinitions, filterArg.value.name.value, leftFilterType);
                                        variableDefinitions = newVariableDefinitions;
                                        variableValues = {
                                            ...variableValues,
                                            [varName]: valueWithoutRightFilter
                                        };
                                        newValue = {
                                            kind: 'Variable',
                                            name: {
                                                kind: 'Name',
                                                value: varName
                                            }
                                        };
                                        break;
                                    case 'ObjectValue':
                                        hasRightFilter = filterArg.value.fields.some(field => field.name.value == rightFilterFieldName);
                                        if (hasRightFilter) {
                                            newValue = {
                                                kind: 'ObjectValue',
                                                ...filterArg.value,
                                                fields: filterArg.value.fields.filter(field => field.name.value != rightFilterFieldName)
                                            };
                                        } else {
                                            newValue = filterArg.value;
                                        }

                                        break;
                                    default:
                                        throw new Error(`Invalid value for filter arg: ${filterArg.value.kind}`);
                                }

                                child = {
                                    ...child,
                                    arguments: [
                                        ...(child.arguments || []),
                                        {
                                            kind: 'Argument',
                                            name: {
                                                kind: 'Name',
                                                value: FILTER_ARG
                                            },
                                            value: newValue
                                        }
                                    ]
                                };
                            }

                        }

                        let hasRightOrderBy = false;

                        // remove order clause if it actually applies to the right side
                        const orderBy = (child.arguments || []).filter(arg => arg.name.value == ORDER_BY_ARG)[0];
                        if (orderBy) {
                            let orderByValue: string;
                            switch (orderBy.value.kind) {
                                case 'Variable':
                                    orderByValue = variableValues[orderBy.value.name.value];
                                    break;
                                case 'EnumValue':
                                    orderByValue = orderBy.value.value;
                                    break;
                                default:
                                    throw new Error(`Invalid value for orderBy arg: ${orderBy.value.kind}`);
                            }

                            hasRightOrderBy = orderByValue.startsWith(metadata.join.linkField + '_');
                            if (hasRightOrderBy) {
                                child = {
                                    ...child,
                                    arguments: child.arguments!.filter(arg => arg != orderBy)
                                };
                            }
                        }

                        if (child.arguments && (hasRightOrderBy || hasRightFilter)) {
                            // can't limit the number of left objects if the result set depends on the right side
                            child = {
                                ...child,
                                arguments: child.arguments!.filter(arg => arg.name.value != FIRST_ARG)
                            };
                        }
                    }
                    return child;
                },

                leave(child: FieldNode): FieldNode | undefined {
                    const fieldStackTop = fieldStack.pop();
                    if (fieldStackTop && fieldStackTop.joinConfig && !fieldStackTop.isLinkFieldSelectedYet) {
                        return {
                            ...child,
                            selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                    ...(child.selectionSet ? child.selectionSet.selections : []),
                                    createFieldNode(fieldStackTop.joinConfig.linkField, JOIN_ALIAS)
                                ]
                            }
                        };
                    }
                    return undefined;
                }
            }
        }));

        // Remove now unnecessary fragments, to avoid processing them in further modules
        // Remove unnecessary variables, e.g. the joined filters
        document = dropUnusedFragments(document);

        const operationWithVariables = {
            ...document.definitions.filter(def => def.kind == 'OperationDefinition')[0],
            variableDefinitions: variableDefinitions.length ? variableDefinitions : undefined
        };

        query = {
            ...query,
            document: {
                ...document,
                definitions: [
                    ...document.definitions.filter(def => def.kind != 'OperationDefinition'),
                    operationWithVariables
                ]
            },
            variableValues
        };

        return dropUnusedVariables(query);
    }
}

class SchemaTransformationInfo {
    /**
     * Maps typeName.joinField to the information gathered while transforming a join field
     */
    private readonly joinTransformationInfos = new Map<string, JoinTransformationInfo>();

    getJoinTransformationInfo(typeName: string, fieldName: string): JoinTransformationInfo | undefined {
        return this.joinTransformationInfos.get(this.getJoinTransformationInfoKey(typeName, fieldName));
    }

    setJoinTransformationInfo(typeName: string, fieldName: string, info: JoinTransformationInfo) {
        this.joinTransformationInfos.set(this.getJoinTransformationInfoKey(typeName, fieldName), info);
    }

    private getJoinTransformationInfoKey(typeName: string, fieldName: string) {
        return `${typeName}.${fieldName}`;
    }

    /**
     * Maps typeName.linkField to the information gathered while transforming a link field
     */
    private readonly linkTransformationInfos = new Map<string, LinkTransformationInfo>();

    getLinkTransformationInfo(typeName: string, fieldName: string): LinkTransformationInfo | undefined {
        return this.linkTransformationInfos.get(this.getLinkTransformationInfoKey(typeName, fieldName));
    }

    setLinkTransformationInfo(typeName: string, fieldName: string, info: LinkTransformationInfo) {
        this.linkTransformationInfos.set(this.getLinkTransformationInfoKey(typeName, fieldName), info);
    }

    private getLinkTransformationInfoKey(typeName: string, fieldName: string) {
        return `${typeName}.${fieldName}`;
    }
}

interface JoinTransformationInfo {
    /**
     * The original input type of the left filter, or undefined if there was no filter on the left field
     */
    readonly leftFilterArgType: GraphQLInputObjectType | undefined;
}

interface LinkTransformationInfo {
}

/**
 * This is a token for an object which has already been resolved via the link target endpoint (as apposed to being a link key)
 */
class ResolvedLinkObject {
    private _ResolvedLinkObject: never;

    constructor(obj: any) {
        Object.assign(this, obj);
    }
}

class SchemaLinkTransformer implements ExtendedSchemaTransformer {
    public readonly transformationInfo = new SchemaTransformationInfo();

    constructor(private readonly schema: ExtendedSchema) {

    }

    transformField(config: GraphQLNamedFieldConfigWithMetadata<any, any>, context: FieldTransformationContext): GraphQLNamedFieldConfigWithMetadata<any, any> {
        if (config.metadata && config.metadata.link) {
            config = this.transformLinkField(config, context, config.metadata.link);
        }
        if (config.metadata && config.metadata.join) {
            config = this.transformJoinField(config, context, config.metadata.join);
        }

        return config;
    }

    transformLinkField(config: GraphQLNamedFieldConfigWithMetadata<any, any>, context: FieldTransformationContext, linkConfig: LinkConfig): GraphQLNamedFieldConfigWithMetadata<any, any> {
        const unlinkedSchema = this.schema.schema;
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
        async function fetchDeferred(key: any, info: SlimGraphQLResolveInfo, context: any) {
            // the fieldNodes array is unique each call, but each individual fieldNode is reused). We can not easily
            // merge the selection sets because they may have collisions. However, we could merge all queries to one
            // endpoint (dataLoader over dataLoaders).
            // also include context because it is also used
            const dataLoaderKey = [...info.fieldNodes, context];
            let dataLoader = dataLoaders.get(dataLoaderKey);
            if (!dataLoader) {
                dataLoader = new DataLoader(keys => fetchLinkedObjects({
                    keys, info, unlinkedSchema, keyType, linkConfig, context
                }));
                dataLoaders.set(dataLoaderKey, dataLoader);
            }

            return dataLoader.load(key);
        }

        return {
            ...config,
            resolve: async (source, vars, context, info) => {
                const fieldNode = info.fieldNodes[0];
                const originalValue = config.resolve ? await config.resolve(source, vars, context, info) : source[fieldNode.name.value];
                if (!originalValue || originalValue instanceof ResolvedLinkObject) {
                    return originalValue;
                }

                const extendedInfo = {...info, context};
                if (isListMode) {
                    const keys: any[] = originalValue;
                    return Promise.all(keys.map(key => fetchDeferred(key, info, context)));
                } else {
                    const key = originalValue;
                    return fetchDeferred(key, info, context);
                }
            },
            type: isListMode ? new GraphQLList(targetRawType) : targetRawType
        };
    }

    transformJoinField(config: GraphQLNamedFieldConfigWithMetadata<any, any>, context: FieldTransformationContext, joinConfig: JoinConfig): GraphQLNamedFieldConfigWithMetadata<any, any> {
        const linkFieldName = joinConfig.linkField;
        const leftType = getNamedType(context.oldField.type);
        if (!(leftType instanceof GraphQLObjectType) && !(leftType instanceof GraphQLInterfaceType)) {
            throw new Error(`@join feature only supported on object types and interface types, but is ${leftType}`);
        }
        const linkField: GraphQLField<any, any> = leftType.getFields()[linkFieldName]; // why any?
        if (!linkField) {
            throw new Error(`linkField ${JSON.stringify(linkFieldName)} configured by @join does not exist on ${leftType.name}`);
        }
        const linkFieldMetadata = this.schema.getFieldMetadata(<GraphQLObjectType>leftType, linkField); // no metadata on interfaces yet
        const linkConfig = linkFieldMetadata ? linkFieldMetadata.link : undefined;
        if (!linkConfig) {
            throw new Error(`Field ${leftType.name}.${linkFieldName} is referenced as linkField but has no @link configuration`);
        }
        if (!linkConfig.batchMode || !linkConfig.keyField) {
            throw new Error(`@join only possible on @link fields with batchMode=true and keyField set`);
        }
        const {fieldPath: targetFieldPath, field: targetField} = parseLinkTargetPath(linkConfig.field, this.schema.schema) ||
        throwError(`Link on ${context.oldOuterType}.${config.name} defines target field as ${linkConfig.field} which does not exist in the schema`);

        if (isListType(linkField.type)) {
            throw new Error(`@join not available for linkFields with array type (${context.oldOuterType}.${config.name} specifies @join with linkName ${linkFieldName}`);
        }

        const leftObjectType = getNamedType(context.oldField.type);

        const keyType = getNamedType(context.mapType(linkField.type));
        if (!(keyType instanceof GraphQLScalarType)) {
            throw new Error(`Type of @link field must be scalar type or list/non-null type of scalar type`);
        }

        // terminology: left and right in the sense of a SQL join (left is link, right is target)


        // filter
        const leftFilterArg = context.oldField.args.filter(arg => arg.name == FILTER_ARG)[0];
        const rightFilterArg = targetField.args.filter(arg => arg.name == FILTER_ARG)[0];

        let newFilterType: GraphQLInputType | undefined;
        if (rightFilterArg) {
            const newFilterTypeName = leftObjectType.name + 'Filter';
            let newFilterFields: GraphQLInputFieldConfigMap;
            if (!leftFilterArg) {
                newFilterFields = {
                    [linkFieldName]: {
                        type: context.mapType(rightFilterArg.type)
                    }
                };
            } else {
                const leftFilterType = context.mapType(leftFilterArg.type);
                if (!(leftFilterType instanceof GraphQLInputObjectType)) {
                    throw new Error(`Expected filter argument of ${leftType.name}.${linkField.name} to be of InputObjectType`);
                }

                newFilterFields = {
                    ...leftFilterType.getFields(),
                    [linkFieldName]: {
                        type: context.mapType(rightFilterArg.type)
                    }
                };
            }
            newFilterType = new GraphQLInputObjectType({
                name: newFilterTypeName,
                fields: newFilterFields
            });
        } else {
            newFilterType = leftFilterArg ? leftFilterArg.type : undefined;
        }

        // only provide explicitly supported arguments, as unsupported arguments likely cause unforseen errors in the result
        let newArguments: GraphQLFieldConfigArgumentMap = {};

        if (newFilterType) {
            newArguments = {
                ...newArguments,
                [FILTER_ARG]: {
                    type: newFilterType
                }
            };
        }

        // order
        const leftOrderByArg = config.args ? config.args[ORDER_BY_ARG] : undefined;
        const rightOrderByArg = targetField.args.filter(arg => arg.name == ORDER_BY_ARG)[0];

        let newOrderByType: GraphQLInputType | undefined;
        if (rightOrderByArg) {
            const rightOrderByType = rightOrderByArg.type;
            if (!(rightOrderByType instanceof GraphQLEnumType)) {
                throw new Error(`Expected orderBy argument of ${targetField.name} to be of enum type`);
            }
            const newOrderByTypeName = leftObjectType.name + 'OrderBy';
            let newEnumValues: GraphQLEnumValue[] = [];
            if (leftOrderByArg) {
                const leftOrderByType = leftOrderByArg.type;
                if (!(leftOrderByType instanceof GraphQLEnumType)) {
                    throw new Error(`Expected orderBy argument of ${config.name} to be of enum type`);
                }
                newEnumValues = leftOrderByType.getValues();
            }
            newEnumValues = [
                ...newEnumValues,
                ...(rightOrderByType.getValues().map(val => ({
                    ...val,
                    name: `${linkFieldName}_${val.name}`,
                    value: `${linkFieldName}_${val.value}`
                })))
            ];


            newOrderByType = new GraphQLEnumType({
                name: newOrderByTypeName,
                values: arrayToObject(newEnumValues.map(({name, value, deprecationReason}) => ({
                    name, value, deprecationReason
                })), val => val.name)
            });
        } else {
            newOrderByType = leftOrderByArg ? leftOrderByArg.type : undefined;
        }

        if (newOrderByType) {
            newArguments = {
                ...newArguments,
                [ORDER_BY_ARG]: {
                    type: newOrderByType
                }
            };
        }

        // first

        const leftFirstArgument = config.args ? config.args[FIRST_ARG] : undefined;
        const rightFirstArgument = targetField.args.filter(arg => arg.name == FIRST_ARG)[0];
        if (leftFirstArgument) {
            newArguments = {
                ...newArguments,
                [FIRST_ARG]: leftFirstArgument
            };
        }

        this.transformationInfo.setJoinTransformationInfo(context.newOuterType.name, config.name, {
            leftFilterArgType: leftFilterArg ? <GraphQLInputObjectType>leftFilterArg.type : undefined
        });

        return {
            ...config,
            args: newArguments,
            resolve: async (source, args, resolveContext, info: GraphQLResolveInfo) => {
                let leftObjects: any[] = await context.oldField.resolve!(source, args, resolveContext, info);

                // Copy the objects so we can add aliases
                leftObjects = [...leftObjects];

                let rightFilter: any = undefined;
                if (FILTER_ARG in args) {
                    rightFilter = args[FILTER_ARG][linkFieldName];
                }
                const doInnerJoin = !!rightFilter;

                let rightOrderBy: string | undefined = undefined;
                if (ORDER_BY_ARG in args) {
                    const orderByValue = args[ORDER_BY_ARG];
                    if (orderByValue.startsWith(linkFieldName + '_')) {
                        rightOrderBy = orderByValue.substr((linkFieldName + '_').length);
                    }
                }

                const selections = flatMap(info.fieldNodes, node => node.selectionSet!.selections);

                // all the names/aliases under which the link field has been requested
                const linkFieldNodes = expandSelections(selections)
                    .filter(node => node.name.value == linkFieldName);
                const linkFieldNodesByAlias: [string | undefined, FieldNode[]][] = Array.from(groupBy(linkFieldNodes, node => getAliasOrName(node)));
                const linkFieldAliases = linkFieldNodesByAlias.map(([alias]) => alias);

                // If the link field does not occur in the selection set, do one request anyway just to apply the filtering or ordering
                // the alias is "undefined" so that it will not occur in the result object
                if ((rightFilter || rightOrderBy) && !linkFieldNodesByAlias.length) {
                    linkFieldNodesByAlias.push([
                        undefined, [
                            {
                                kind: 'Field',
                                name: {
                                    kind: 'Name',
                                    value: linkFieldName
                                }
                            }
                        ]
                    ]);
                }
                // undefined means that the link field was never selected by the user, so it has been added as
                // an alias to JOIN_ALIAS by the query transformer
                const anyAliasFieldNodePair = linkFieldNodesByAlias[0] as  [string | undefined, FieldNode[]]|undefined;
                const anyLinkFieldAlias = anyAliasFieldNodePair ? anyAliasFieldNodePair[0] || JOIN_ALIAS : JOIN_ALIAS;
                const rightKeysToLeftObjects = anyAliasFieldNodePair ? groupBy(leftObjects, obj => obj[anyLinkFieldAlias]) : new Map<any, any[]>();
                const rightKeys = Array.from(rightKeysToLeftObjects.keys());

                const aliasesToRightObjectLists = await Promise.all(linkFieldNodesByAlias.map(async ([alias, fieldNodes]) => {
                    const linkFieldInfo: SlimGraphQLResolveInfo = {
                        operation: info.operation,
                        variableValues: info.variableValues,
                        fragments: info.fragments,
                        fieldNodes
                    };

                    // optimization: if "first" had to be scratched from the left query, do it at least on the right query
                    // we can do this because count(right) >= count(left) always
                    let first: number|undefined = undefined;
                    if ((rightFilter || rightOrderBy) && FIRST_ARG in args) {
                        first = args[FIRST_ARG];
                    }

                    const res = await fetchJoinedObjects({
                        keys: rightKeys,
                        additionalFilter: rightFilter,
                        filterType: rightFilterArg.type,
                        orderBy: rightOrderBy,
                        first,
                        keyType,
                        linkConfig,
                        unlinkedSchema: this.schema.schema,
                        info: linkFieldInfo,
                        context: resolveContext
                    });

                    return {alias, ...res};
                }));

                let leftObjectList = [];
                if (rightOrderBy) {
                    // apply order from right side
                    const anyRightObjectList = aliasesToRightObjectLists[0];
                    const leftObjectsSoFar = new Set<any>();
                    for (const rightObject of anyRightObjectList.orderedObjects) {
                        const rightObjectKey = rightObject[anyRightObjectList.keyFieldAlias];
                        const leftObjectForRightObject = rightKeysToLeftObjects.get(rightObjectKey) || [];

                        // Filter out left object where one alias found a linked object, but another one did not. This
                        // is more consistent and uses would not expect a linked field to be Null with an INNER JOIN.
                        const leftObjectKeyAlias = anyRightObjectList.alias || JOIN_ALIAS;
                        const leftObjectsWithCompleteRightObjects =
                            leftObjectForRightObject.filter(leftObject => aliasesToRightObjectLists.every(({objectsByID}) => objectsByID.has(leftObject[leftObjectKeyAlias])));
                        for (const {alias, orderedObjects, objectsByID} of aliasesToRightObjectLists) {
                            for (const leftObject of leftObjectsWithCompleteRightObjects) {
                                leftObjectsSoFar.add(leftObject);
                                const key = leftObject[alias || JOIN_ALIAS];
                                const rightObject = objectsByID.get(key);
                                if (alias) {
                                    leftObject[alias] = new ResolvedLinkObject(rightObject);
                                }
                            }
                        }
                        leftObjectList.push(...leftObjectsWithCompleteRightObjects);
                    }

                    if (!doInnerJoin) {
                        const isDescSort = rightOrderBy.toUpperCase().endsWith('_DESC');
                        if (!isDescSort && !rightOrderBy.toUpperCase().endsWith('_ASC')) {
                            throw new Error(`Expected order by clause ${rightOrderBy} to end with _ASC or _DESC`);
                        }
                        const leftObjectsWithoutRightObject = leftObjects.filter(obj => !leftObjectsSoFar.has(obj));
                        if (isDescSort) {
                            leftObjectList.push(...leftObjectsWithoutRightObject);
                        } else {
                            leftObjectList.unshift(...leftObjectsWithoutRightObject);
                        }
                    }
                } else {
                    // apply order from left side

                    if (doInnerJoin) {
                        leftObjects = leftObjects.filter(leftObject => aliasesToRightObjectLists.every(({objectsByID, alias}) => objectsByID.has(leftObject[alias || JOIN_ALIAS])));
                    }

                    for (const leftObject of leftObjects) {
                        for (const {alias, objectsByID} of aliasesToRightObjectLists) {
                            const key = leftObject[alias || JOIN_ALIAS];
                            const rightObject = objectsByID.get(key);
                            if (alias) {
                                leftObject[alias] = new ResolvedLinkObject(rightObject);
                            }
                        }
                    }
                    leftObjectList = leftObjects;
                }

                if (args[FIRST_ARG] != undefined) {
                    const first = args[FIRST_ARG];
                    leftObjectList = leftObjectList.slice(0, first);
                }
                return leftObjectList;
            }
        };
    }

}
