import { getNamedType, GraphQLNonNull, GraphQLOutputType, GraphQLType } from 'graphql';
import { FieldTransformationContext } from './schema-transformer';
import { getFieldAsQuery } from './field-as-query';
import { ExtendedSchemaTransformer, GraphQLNamedFieldConfigWithMetadata } from './extended-schema-transformer';
import { walkFields } from './schema-utils';
import { ExtendedSchema } from '../endpoints/extended-introspection';
import DataLoader = require('dataloader');

function getNonNullType<T extends GraphQLType>(type: T|GraphQLNonNull<T>): GraphQLNonNull<T> {
    if (type instanceof GraphQLNonNull) {
        return type;
    }
    return new GraphQLNonNull(type);
}

export class SchemaLinkTransformer implements ExtendedSchemaTransformer {
    constructor(private readonly schema: ExtendedSchema) {

    }

    transformField(config: GraphQLNamedFieldConfigWithMetadata<any, any>, context: FieldTransformationContext): GraphQLNamedFieldConfigWithMetadata<any, any> {
        if (!config.metadata || !config.metadata.link) {
            return config;
        }
        const link = config.metadata.link;
        const field = walkFields(this.schema.schema.getQueryType(), [link.endpoint, ...link.field.split('.')]);
        if (!field) {
            throw new Error(`Link on ${context.oldOuterType}.${config.name} defines target field as ${link.endpoint}.${link.field} which does not exist in the schema`);
        }

        // unwrap list for batch mode, unwrap NonNull because object may be missing -> strip all type wrappers
        // TODO implement links on list fields
        const type = <GraphQLOutputType>getNamedType(context.mapType(field.type));

        return {
            ...config,
            resolve: async (a,b,c, info) => {
                const { document, variableValues } = getFieldAsQuery(info);
                //const result = await execute(this.schema.schema, document, undefined, undefined, variableValues);
                return null;
            },
            type
        };

        /*const dataLoaders = new WeakMap<any, DataLoader<any, any>>();

        const targetEndpoint = this.config.endpointFactory.getEndpoint(targetEndpointConfig);
        let keyFieldAlias: string|undefined;
        const basicResolve = async (value: any, info: GraphQLResolveInfo) => {
            const {fragments, variableDefinitions, variableValues, selectionSet} = getFieldAsQueryParts(info);

            // add variable
            const varType = link.batchMode ? new GraphQLNonNull(new GraphQLList(getNonNullType(originalType))) : originalType;
            const varNameBase = link.argument.split('.').pop()!;
            const { variableDefinitions: extVariableDefinitions, name: varName } =
                addVariableDefinitionSafely(variableDefinitions, varNameBase, varType);

            // add keyField if needed
            let extSelectionSet = selectionSet;
            if (link.batchMode && link.keyField) {
                const { alias, selectionSet: newSelectionSet } =
                    addFieldSelectionSafely(selectionSet, link.keyField, arrayToObject(fragments, f => f.name.value));
                keyFieldAlias = alias;
                extSelectionSet = newSelectionSet;
            }

            const document: DocumentNode = {
                kind: 'Document',
                definitions: [
                    ...fragments,
                    {
                        kind: 'OperationDefinition',
                        operation: 'query', // links are always resolved via query operations
                        variableDefinitions: extVariableDefinitions,
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [
                                {
                                    kind: 'Field',
                                    name: {
                                        kind: 'Name',
                                        value: link.field
                                    },
                                    arguments: [
                                        createNestedArgumentWithVariableNode(link.argument, varName)
                                    ],
                                    selectionSet: extSelectionSet
                                }
                            ]
                        }
                    }
                ]
            };

            const query = {
                document,
                variableValues: {
                    ...variableValues,
                    [varName]: value
                }
            };
            const obj = await targetEndpoint.query(query.document, query.variableValues);
            return obj[link.field];
        };

        const resolveBatch = async (keys: any[], info: GraphQLResolveInfo) => {
            let result;
            if (link.batchMode) {
                result = await basicResolve(keys, info);
            } else {
                result = await keys.map(key => basicResolve(key, info));
            }

            if (!link.batchMode || !link.keyField) {
                // simple case: endpoint returns the objects in the order of given ids
                return result;
            }
            // unordered case: endpoints does not preserve order, so we need to remap based on a key field
            const map = new Map((<any[]>result).map(item => <[any, any]>[item[keyFieldAlias!], item]));
            return keys.map(key => map.get(key));
        };

        const field = endpointQueryType.getFields()[link.field];
        const originalType = config.type;
        // unwrap list for batch mode, unwrap NonNull because object may be missing -> strip all type wrappers
        config.type = <GraphQLOutputType>getNamedType(context.mapType(field.type));
        config.resolve = async (source, args, context, info) => {
            const fieldNode = info.fieldNodes[0];
            const alias = fieldNode.alias ? fieldNode.alias.value : fieldNode.name.value;
            const value = source[alias];
            if (!value) {
                return value;
            }

            // TODO include all the info.fieldNodes in the key somehow
            // the fieldNodes array is unique each call, but each individual fieldNode is reused). We can not easily
            // merge the selection sets because they may have collisions. However, we could merge all queries to one
            // endpoint (dataLoader over dataLoaders).
            let dataLoader = dataLoaders.get(context);
            if (!dataLoader) {
                dataLoader = new DataLoader(keys => resolveBatch(keys, info));
                dataLoaders.set(context, dataLoader);
            }

            return dataLoader.load(value);
        };*/
    }
}
