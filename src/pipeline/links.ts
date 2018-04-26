import {
    DocumentNode, FieldNode, getNamedType, GraphQLArgument, GraphQLArgumentConfig, GraphQLEnumType, GraphQLEnumValue,
    GraphQLEnumValueConfigMap, GraphQLField, GraphQLFieldConfigArgumentMap, GraphQLInputFieldConfigMap,
    GraphQLInputObjectType, GraphQLInputType, GraphQLInterfaceType, GraphQLList, GraphQLNamedType, GraphQLObjectType,
    GraphQLResolveInfo, OperationDefinitionNode, Thunk, TypeInfo, ValueNode, visit, visitWithTypeInfo
} from 'graphql';
import { PipelineModule } from './pipeline-module';
import { ExtendedSchema, JoinConfig, LinkConfig } from '../extended-schema/extended-schema';
import {
    ExtendedSchemaTransformer, GraphQLFieldConfigMapWithMetadata, GraphQLNamedFieldConfigWithMetadata,
    transformExtendedSchema
} from '../extended-schema/extended-schema-transformer';
import { FieldsTransformationContext, FieldTransformationContext } from 'graphql-transformer';
import { arrayToObject, compact, flatMap, groupBy, objectEntries, throwError } from '../utils/utils';
import { ArrayKeyWeakMap } from '../utils/multi-key-weak-map';
import {
    fetchJoinedObjects, fetchLinkedObjects, FILTER_ARG, FIRST_ARG, getKeyType, ORDER_BY_ARG, parseLinkTargetPath
} from './helpers/link-helpers';
import { isListType } from '../graphql/schema-utils';
import { Query } from '../graphql/common';
import { dropUnusedFragments, dropUnusedVariables, SlimGraphQLResolveInfo } from '../graphql/field-as-query';
import {
    addVariableDefinitionSafely, createFieldNode, expandSelections, getAliasOrName
} from '../graphql/language-utils';
import { WeavingError, WeavingErrorConsumer } from '../config/errors';
import DataLoader = require('dataloader');
import { nestErrorHandling } from '../config/error-handling';

const JOIN_ALIAS = '_joined'; // used when a joined field is not selected

/**
 * Adds a feature to link fields to types of other endpoints
 */
export class LinksModule implements PipelineModule {
    private unlinkedSchema: ExtendedSchema | undefined;
    private linkedSchema: ExtendedSchema | undefined;
    private transformationInfo: SchemaTransformationInfo | undefined;

    constructor(private moduleConfig: { reportError: WeavingErrorConsumer }) {
    }

    transformExtendedSchema(schema: ExtendedSchema): ExtendedSchema {
        this.unlinkedSchema = schema;
        const transformer = new SchemaLinkTransformer(schema, this.moduleConfig.reportError);
        this.linkedSchema = transformExtendedSchema(schema, transformer);
        this.transformationInfo = transformer.transformationInfo;
        return this.linkedSchema!;
    }

    /**
     * Replaces linked fields by scalar fields
     *
     * The resolver of the linked field will do the fetch of the linked object, so here we just need the scalar value
     */
    transformQuery(query: Query): Query {
        if (!this.linkedSchema || !this.unlinkedSchema) {
            throw new Error(`Schema is not built yet`);
        }

        // this funciton is quite heavy, don't call it if the schema does not use @join or @link at all
        if (!this.transformationInfo || this.transformationInfo.isEmpty()) {
            return query;
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
        let hasChanges = false;

        let document: DocumentNode = visit(query.document, visitWithTypeInfo(typeInfo, {
            Field: {
                enter: (child: FieldNode) => {
                    const oldChild = child;
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
                    if (!typeInfo.getFieldDef()) {
                        throw new Error(`Failed to retrieve field definition for field ${child.name.value}`);
                    }
                    const linkInfo = this.transformationInfo!.getLinkTransformationInfo(parentType.name, typeInfo.getFieldDef().name);
                    if (linkInfo && linkInfo.linkConfig) {
                        if (fieldStackOuter && fieldStackOuter.joinConfig && fieldStackOuter.joinConfig.linkField == child.name.value) {
                            fieldStackOuter.isLinkFieldSelectedYet = true;
                        }

                        // remove selection from the field node and map it to the source field
                        child = createFieldNode(linkInfo.sourceFieldName, getAliasOrName(child), undefined, child.arguments);
                    }

                    const metadata = this.unlinkedSchema!.getFieldMetadata(parentType, typeInfo.getFieldDef());
                    if (metadata && metadata.join) {
                        fieldStackTop.joinConfig = metadata.join;
                        fieldStackTop.isLinkFieldSelectedYet = false;
                        const transformationInfo = this.transformationInfo!.getJoinTransformationInfo(parentType.name, typeInfo.getFieldDef().name);
                        if (!transformationInfo) {
                            // no transformation info means, that the join is handled by a nested graphql-weaver
                            return child;
                        }

                        let hasRightFilter = false;

                        const rightObjectType = getNamedType(typeInfo.getType()) as GraphQLObjectType;
                        const linkMetadata = this.unlinkedSchema!.getFieldMetadata(rightObjectType, metadata.join.linkField);
                        if (!linkMetadata || !linkMetadata.link) {
                            throw new Error(`Failed to retrieve linkMetadata for join field ${child.name.value} (looked up ${typeInfo.getType()}.${metadata.join.linkField})`);
                        }
                        const outputLinkFieldName = linkMetadata.link.linkFieldName || metadata.join.linkField;

                        // remove right filter
                        const filterArg = (child.arguments || []).filter(arg => arg.name.value == FILTER_ARG)[0];
                        const rightFilterFieldName = outputLinkFieldName;
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
                                        const value = variableValues[filterArg.value.name.value] || {};
                                        hasRightFilter = rightFilterFieldName in value;
                                        const valueWithoutRightFilter = {...value, [rightFilterFieldName]: undefined};
                                        // this also takes care of changing the variable type to the original left type
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
                                    case 'NullValue':
                                        newValue = filterArg.value;
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
                            let orderByValue: string | undefined;
                            switch (orderBy.value.kind) {
                                case 'Variable':
                                    orderByValue = variableValues[orderBy.value.name.value];
                                    break;
                                case 'EnumValue':
                                    orderByValue = orderBy.value.value;
                                    break;
                                case 'NullValue':
                                    orderByValue = undefined;
                                    break;
                                default:
                                    throw new Error(`Invalid value for orderBy arg: ${orderBy.value.kind}`);
                            }

                            hasRightOrderBy = orderByValue != undefined && orderByValue.startsWith(outputLinkFieldName + '_');
                            // re-do the argument in any case, because if it was a variable its type is the merge-type
                            // instead of the original left type
                            // let dropUnusedVariables() below take care of the variable definition in that case

                            // first, remove
                            let newArgs = (child.arguments || []).filter(arg => arg != orderBy);
                            // then, add if appropiate
                            if (orderByValue && !hasRightOrderBy) {
                                newArgs = [
                                    ...newArgs,
                                    {
                                        kind: 'Argument',
                                        name: {
                                            kind: 'Name',
                                            value: ORDER_BY_ARG
                                        },
                                        value: {
                                            kind: 'EnumValue',
                                            value: orderByValue
                                        }
                                    }
                                ];
                            }

                            child = {
                                ...child,
                                arguments: newArgs
                            };
                        }

                        if (child.arguments && (hasRightOrderBy || hasRightFilter)) {
                            // can't limit the number of left objects if the result set depends on the right side
                            child = {
                                ...child,
                                arguments: child.arguments!.filter(arg => arg.name.value != FIRST_ARG)
                            };
                        }
                    }
                    if (child != oldChild) {
                        hasChanges = true;
                        return child;
                    }
                    return undefined;
                },

                leave(child: FieldNode): FieldNode | undefined {
                    const fieldStackTop = fieldStack.pop();
                    if (fieldStackTop && fieldStackTop.joinConfig && !fieldStackTop.isLinkFieldSelectedYet) {
                        hasChanges = true;
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

        // avoid query re-building if no @link or @join field is used
        if (!hasChanges) {
            return query;
        }

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

    isEmpty() {
        return this.linkTransformationInfos.size == 0 && this.joinTransformationInfos.size == 0;
    }
}

interface JoinTransformationInfo {
    /**
     * The original input type of the left filter, or undefined if there was no filter on the left field
     */
    readonly leftFilterArgType: GraphQLInputObjectType | undefined;
}

interface LinkTransformationInfo {
    readonly linkConfig: LinkConfig;
    readonly sourceFieldName: string;
}

/**
 * This is a token for an object which has already been resolved via the link target endpoint (as apposed to being a link key)
 */
class ResolvedLinkObject {
    private _ResolvedLinkObject: never;

    constructor(obj: { [key: string]: any }) {
        Object.assign(this, obj);
    }

    toString() {
        return '[ResolvedLinkObject]';
    }
}

class SchemaLinkTransformer implements ExtendedSchemaTransformer {
    public readonly transformationInfo = new SchemaTransformationInfo();

    constructor(private readonly schema: ExtendedSchema, private readonly reportError: WeavingErrorConsumer) {

    }

    transformField(config: GraphQLNamedFieldConfigWithMetadata<any, any>, context: FieldTransformationContext): GraphQLNamedFieldConfigWithMetadata<any, any> {
        if (config.metadata && config.metadata.join && !config.metadata.join.ignore) {
            const joinMetadata = config.metadata.join;
            nestErrorHandling(this.reportError, `Error in @join config on ${config.name}`, (reportError) => {
                config = this.transformJoinField(config, context, joinMetadata, reportError);
                config.metadata!.join!.ignore = true;
            });
        }

        return config;
    }

    transformFields(fields: GraphQLFieldConfigMapWithMetadata, context: FieldsTransformationContext): GraphQLFieldConfigMapWithMetadata {
        const newFields: GraphQLFieldConfigMapWithMetadata = {};
        for (const [name, fieldConfig] of objectEntries(fields)) {
            let handledSuccessfully = false;
            if (fieldConfig.metadata && fieldConfig.metadata.link && !fieldConfig.metadata.link.ignore) {
                const linkConfig = fieldConfig.metadata.link;
                nestErrorHandling(this.reportError, `Error in @link config on ${context.oldOuterType.name}.${name}`, (reportError) => {
                    const {name: newName, ...newConfig} = this.transformLinkField({
                        ...fieldConfig, name
                    }, context, linkConfig, reportError);
                    if (newName != name) {
                        newFields[name] = {
                            ...fieldConfig,
                            metadata: {
                                ...fieldConfig.metadata,
                                link: {
                                    ...linkConfig,
                                    ignore: true
                                }
                            }
                        }; // preserve old field with to linked flag
                    }
                    newFields[newName] = {
                        ...newConfig,
                        metadata: {
                            ...newConfig.metadata,
                            link: {
                                ...linkConfig,
                                ignore: true
                            }
                        }
                    };
                    handledSuccessfully = true;
                });
            }

            // if no link config found, or link preparation threw an error, just keep the old field
            if (!handledSuccessfully) {
                newFields[name] = fieldConfig;
            }
        }
        return newFields;
    }

    private transformLinkField(config: GraphQLNamedFieldConfigWithMetadata<any, any>, context: FieldsTransformationContext, linkConfig: LinkConfig, reportError: WeavingErrorConsumer): GraphQLNamedFieldConfigWithMetadata<any, any> {
        const unlinkedSchema = this.schema.schema;
        const {fieldPath: targetFieldPath, field: targetField} = parseLinkTargetPath(linkConfig.field, this.schema.schema) ||
        throwError(() => new WeavingError(`Target field ${JSON.stringify(linkConfig.field)} does not exist`));

        const targetRawType = <GraphQLObjectType | GraphQLInterfaceType>getNamedType(context.mapType(targetField.type));

        if (!(targetRawType instanceof GraphQLObjectType) && !(targetRawType instanceof GraphQLInterfaceType)) {
            throw new WeavingError(`Target field ${JSON.stringify(linkConfig.field)} is of type ${targetRawType}, but only object and interface types are supported.`);
        }
        if (linkConfig.keyField && !(linkConfig.keyField in targetRawType.getFields())) {
            throw new WeavingError(`keyField ${JSON.stringify(linkConfig.keyField)} does not exist in target type ${targetRawType.name}.`);
        }
        if (linkConfig.batchMode && linkConfig.oneToMany) {
            throw new WeavingError(`batchMode and oneToMany are mutually exclusive.`);
        }
        if (linkConfig.oneToMany && !isListType(targetField.type)) {
            throw new WeavingError(`oneToMany is configured, but target field ${JSON.stringify(linkConfig.field)} is not of type GraphQLList.`);
        }

        const isListMode = isListType(config.type);
        const keyType = getKeyType({
            linkFieldName: config.name,
            linkFieldType: context.mapType(config.type),
            targetField,
            parentObjectType: context.mapType(context.oldOuterType),
            linkConfig,
            reportError
        });

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

        const linkFieldName = linkConfig.linkFieldName || config.name;

        this.transformationInfo.setLinkTransformationInfo(context.newOuterType.name, linkFieldName, {
            linkConfig,
            sourceFieldName: config.name
        });

        return {
            ...config,
            name: linkFieldName,
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
            type: isListMode || linkConfig.oneToMany ? new GraphQLList(targetRawType) : targetRawType
        };
    }

    private transformJoinField(config: GraphQLNamedFieldConfigWithMetadata<any, any>, context: FieldTransformationContext, joinConfig: JoinConfig,
                               reportError: WeavingErrorConsumer): GraphQLNamedFieldConfigWithMetadata<any, any> {
        const linkFieldName = joinConfig.linkField;
        const leftType = getNamedType(context.oldField.type);
        if (!(leftType instanceof GraphQLObjectType) && !(leftType instanceof GraphQLInterfaceType)) {
            throw new WeavingError(`@join feature only supported on object types and interface types, but is ${leftType.constructor.name}`);
        }
        const linkField: GraphQLField<any, any> = leftType.getFields()[linkFieldName]; // why any?
        if (!linkField) {
            throw new WeavingError(`linkField ${JSON.stringify(linkFieldName)} does not exist in this type`);
        }
        const linkFieldMetadata = this.schema.getFieldMetadata(<GraphQLObjectType>leftType, linkField); // no metadata on interfaces yet
        const linkConfig = linkFieldMetadata ? linkFieldMetadata.link : undefined;
        if (!linkConfig) {
            throw new WeavingError(`Field ${JSON.stringify(linkFieldName)} is referenced as linkField but has no @link configuration`);
        }
        if (!linkConfig.batchMode || !linkConfig.keyField) {
            throw new WeavingError(`@join is only possible on @link fields with batchMode=true and keyField set`);
        }
        if (linkConfig.oneToMany) {
            throw new WeavingError(`Link specifies oneToMany, but @join does not support one-to-many links.`);
        }
        const {fieldPath: targetFieldPath, field: targetField} = parseLinkTargetPath(linkConfig.field, this.schema.schema) ||
        throwError(() => new WeavingError(`Link defines target field as ${JSON.stringify(linkConfig.field)} which does not exist`));

        if (isListType(linkField.type)) {
            throw new WeavingError(`@join not available for linkFields with array type`);
        }

        const leftObjectType = getNamedType(context.oldField.type);
        const rightObjectType = getNamedType(targetField.type);

        const keyType = getKeyType({
            linkFieldName,
            linkFieldType: linkField.type,
            targetField,
            parentObjectType: leftObjectType,
            linkConfig,
            reportError
        });

        // This may differ from the name of the linkField in case the link field is renamed
        const outLinkFieldName = linkConfig.linkFieldName || linkFieldName;

        // terminology: left and right in the sense of a SQL join (left is link, right is target)


        // filter
        const leftFilterArg = context.oldField.args.filter(arg => arg.name == FILTER_ARG)[0];
        const rightFilterArg = targetField.args.filter(arg => arg.name == FILTER_ARG)[0];

        let newFilterType: GraphQLInputType | undefined;
        if (rightFilterArg) {
            const newFilterTypeName = this.generateJoinFilterTypeName(leftObjectType, leftFilterArg, rightObjectType, rightFilterArg);
            let newFilterFields: GraphQLInputFieldConfigMap;
            if (!leftFilterArg) {
                newFilterFields = {
                    [outLinkFieldName]: {
                        type: context.mapType(rightFilterArg.type)
                    }
                };
            } else {

                const leftFilterType = context.mapType(leftFilterArg.type);
                if (!(leftFilterType instanceof GraphQLInputObjectType)) {
                    throw new WeavingError(`Type of filter argument should be InputObjectType, but is ${leftFilterArg.type}`);
                }

                newFilterFields = {
                    ...leftFilterType.getFields(),
                    [outLinkFieldName]: {
                        type: context.mapType(rightFilterArg.type)
                    }
                };
            }
            newFilterType = this.findOrCreateInputObjectType(newFilterTypeName, {fields: newFilterFields});
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
            let rightOrderByType = getNamedType(rightOrderByArg.type);
            if (!(rightOrderByType instanceof GraphQLEnumType)) {
                throw new WeavingError(`orderBy argument of target field ${JSON.stringify(targetFieldPath)} should be of enum type, but is ${rightOrderByType.constructor.name}`);
            }
            const newOrderByTypeName = this.generateJoinOrderByTypeName(leftObjectType, leftOrderByArg, rightObjectType, rightOrderByArg);
            let newEnumValues: GraphQLEnumValue[] = [];
            if (leftOrderByArg) {
                let leftOrderByType = getNamedType(leftOrderByArg.type);
                if (!(leftOrderByType instanceof GraphQLEnumType)) {
                    throw new WeavingError(`orderBy argument should be of enum type, but is ${leftOrderByType.constructor.name}`);
                }
                newEnumValues = leftOrderByType.getValues();
            }
            newEnumValues = [
                ...newEnumValues,
                ...(rightOrderByType.getValues().map(val => ({
                    ...val,
                    name: `${outLinkFieldName}_${val.name}`,
                    value: `${outLinkFieldName}_${val.value}`
                })))
            ];

            newOrderByType = this.findOrCreateEnumType(newOrderByTypeName, {
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
                if (args[FILTER_ARG] != undefined) {
                    rightFilter = args[FILTER_ARG][outLinkFieldName];
                }
                const doInnerJoin = !!rightFilter;

                let rightOrderBy: string | undefined = undefined;
                if (args[ORDER_BY_ARG] != undefined) {
                    const orderByValue = args[ORDER_BY_ARG];
                    if (orderByValue.startsWith(outLinkFieldName + '_')) {
                        rightOrderBy = orderByValue.substr((outLinkFieldName + '_').length);
                    }
                }

                const selections = flatMap(info.fieldNodes, node => node.selectionSet!.selections);

                // all the names/aliases under which the link field has been requested
                const linkFieldNodes = expandSelections(selections, info.fragments)
                    .filter(node => node.name.value == outLinkFieldName);
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
                                    value: outLinkFieldName
                                }
                            }
                        ]
                    ]);
                }
                // undefined means that the link field was never selected by the user, so it has been added as
                // an alias to JOIN_ALIAS by the query transformer
                const anyAliasFieldNodePair = linkFieldNodesByAlias[0] as  [string | undefined, FieldNode[]] | undefined;
                const anyLinkFieldAlias = anyAliasFieldNodePair ? anyAliasFieldNodePair[0] || JOIN_ALIAS : JOIN_ALIAS;
                const rightKeysToLeftObjects = anyAliasFieldNodePair ? groupBy(leftObjects, obj => obj[anyLinkFieldAlias]) : new Map<any, any[]>();
                const rightKeys = Array.from(rightKeysToLeftObjects.keys());

                const aliasesToRightObjectLists = await Promise.all(linkFieldNodesByAlias.map(async ([alias, fieldNodes]) => {
                    const linkFieldInfo: SlimGraphQLResolveInfo = {
                        operation: info.operation,
                        variableValues: info.variableValues,
                        fragments: info.fragments,
                        fieldNodes,
                        path: info.path
                    };

                    // optimization: if "first" had to be scratched from the left query, do it at least on the right query
                    // we can do this because count(right) >= count(left) always
                    // this is not possible for outer joins, because there we need to detect if an object *has* a right
                    // object, and limiting the results would miss some right objects
                    let first: number | undefined = undefined;
                    if ((rightFilter || rightOrderBy) && doInnerJoin && FIRST_ARG in args) {
                        first = args[FIRST_ARG];
                    }

                    const res = await fetchJoinedObjects({
                        keys: compact(rightKeys), // remove null keys
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
                                if (alias && rightObject) {
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
                            if (alias && rightObject) {
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

    protected generateJoinFilterTypeName(leftObjectType: GraphQLNamedType, leftFilterArg: GraphQLArgument, rightObjectType: GraphQLNamedType, rightFilterArg: GraphQLArgument): string {
        let leftPart = '';
        let rightPart = '';
        if (leftFilterArg) {
            leftPart = leftFilterArg.type instanceof GraphQLInputObjectType ? leftFilterArg.type.name.replace(/Filter$/, '') : leftObjectType.name;
        }
        if (rightFilterArg) {
            rightPart = rightFilterArg.type instanceof GraphQLInputObjectType ? rightFilterArg.type.name.replace(/Filter$/, '') : rightObjectType.name;
        }
        const separator = leftPart && rightPart ? 'With' : '';
        return `${leftPart}${separator}${rightPart}JoinedFilter`;
    }

    protected generateJoinOrderByTypeName(leftObjectType: GraphQLNamedType, leftOrderArg: GraphQLArgumentConfig | undefined, rightObjectType: GraphQLNamedType, rightOrderArg: GraphQLArgumentConfig): string {
        let leftPart = '';
        let rightPart = '';
        if (leftOrderArg) {
            leftPart = leftOrderArg.type instanceof GraphQLEnumType ? leftOrderArg.type.name.replace(/OrderBy$/, '') : leftObjectType.name;
        }
        if (rightOrderArg) {
            rightPart = rightOrderArg.type instanceof GraphQLEnumType ? rightOrderArg.type.name.replace(/OrderBy$/, '') : rightObjectType.name;
        }
        const separator = leftPart && rightPart ? 'With' : '';
        return `${leftPart}${separator}${rightPart}JoinedOrderBy`;
    }

    protected findOrCreateInputObjectType(name: string, fallback: { fields: Thunk<GraphQLInputFieldConfigMap>, description?: string }): GraphQLInputObjectType | GraphQLEnumType {
        let result = this.inputObjectTypeMap[name];
        if (!result) {
            result = new GraphQLInputObjectType({...fallback, name: name});
            this.inputObjectTypeMap[name] = result;
        }
        return result;
    }

    protected findOrCreateEnumType(name: string, fallback: { values: GraphQLEnumValueConfigMap, description?: string; }): GraphQLInputObjectType | GraphQLEnumType {
        let result = this.inputObjectTypeMap[name];
        if (!result) {
            result = new GraphQLEnumType({...fallback, name: name});
            this.inputObjectTypeMap[name] = result;
        }
        return result;
    }

    private inputObjectTypeMap: { [typeName: string]: GraphQLInputObjectType | GraphQLEnumType } = {};

}
