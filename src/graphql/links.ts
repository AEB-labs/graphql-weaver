import {
    ArgumentNode, getNamedType, GraphQLObjectType, GraphQLSchema, ValueNode, VariableDefinitionNode
} from 'graphql';
import { FieldTransformationContext, GraphQLNamedFieldConfig, SchemaTransformer } from './schema-transformer';
import { EndpointConfig, LinkConfigMap } from '../config/proxy-configuration';
import { createResolver } from './proxy-resolver';
import { getReverseTypeRenamer, getTypePrefix } from './renaming';

export class SchemaLinkTransformer implements SchemaTransformer {
    private endpointMap: Map<string, EndpointConfig>;

    constructor(private endpoints: EndpointConfig[], private schema: GraphQLSchema, private links: LinkConfigMap) {
        this.endpointMap = new Map(endpoints.map(endpoint => <[string, EndpointConfig]>[endpoint.name, endpoint]));
    }

    transformField(config: GraphQLNamedFieldConfig<any, any>, context: FieldTransformationContext) {
        const splitTypeName = this.splitTypeName(context.oldOuterType.name);
        if (!splitTypeName) {
            return;
        }
        const endpoint = this.endpointMap.get(splitTypeName.endpoint);
        if (!endpoint) {
            throw new Error(`Endpoint ${splitTypeName.endpoint} not found`);
        }
        const linkName = splitTypeName.originalTypeName + '.' + config.name;
        const link = endpoint.links[linkName];
        if (link) {
            const targetEndpoint = this.endpointMap.get(link.endpoint);
            if (!targetEndpoint) {
                throw new Error(`Link ${linkName} refers to nonexistent endpoint ${link.endpoint}`);
            }
            const endpointQueryType = this.schema.getQueryType().getFields()[targetEndpoint.name].type;
            if (!(endpointQueryType instanceof GraphQLObjectType)) {
                throw new Error(`Expected object type as query type of endpoint ${targetEndpoint.name}`);
            }
            const field = endpointQueryType.getFields()[link.field];
            const originalType = config.type;
            config.type = context.mapType(field.type);
            config.resolve = async (source, args, context, info) => {
                const varName = 'param';
                const fieldNode = info.fieldNodes[0];
                const alias = fieldNode.alias ? fieldNode.alias.value : fieldNode.name.value;
                const value = source[alias];
                if (!value) {
                    return value;
                }
                const resolver = createResolver({
                    url: targetEndpoint.url,
                    operation: 'query',
                    links: this.links,
                    typeRenamer: getReverseTypeRenamer(targetEndpoint),
                    transform: ({operation, fragments, variables}, context) => {
                        return {
                            fragments,
                            operation: {
                                ...operation,
                                operation: 'query', // links are always resolved via query operations
                                variableDefinitions: [
                                    ...(operation.variableDefinitions || []),
                                    createVariableDefinitionNode(varName, getNamedType(originalType).name)
                                ],
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
                                            selectionSet: operation.selectionSet
                                        }
                                    ]
                                }
                            },
                            variables: {
                                ...variables,
                                [varName]: context.source[alias]
                            }
                        };
                    }
                });
                const result = await resolver(source, args, context, info);
                return result[link.field];
            };
        }
    }

    private splitTypeName(mergedName: string): { endpoint: string, originalTypeName: string } | undefined {
        for (const endpoint of this.endpoints) {
            const prefix = getTypePrefix(endpoint);
            if (mergedName.startsWith(prefix)) {
                return {
                    endpoint: endpoint.name,
                    originalTypeName: mergedName.substr(prefix.length)
                };
            }
        }
        return undefined;
    }
}

function createVariableDefinitionNode(varName: string, type: string): VariableDefinitionNode {
    return {
        kind: 'VariableDefinition',
        variable: {
            kind: 'Variable',
            name: {
                kind: 'Name',
                value: varName
            }
        },
        type: {
            kind: 'NamedType',
            name: {
                kind: 'Name',
                value: type
            }
        }
    };
}

function createNestedArgumentWithVariableNode(argumentPath: string, variableName: string): ArgumentNode {
    const parts = argumentPath.split('.');
    const argName = parts.shift();
    if (!argName) {
        throw new Error('Argument must not be empty');
    }

    let value: ValueNode = {
        kind: 'Variable',
        name: {
            kind: 'Name',
            value: variableName
        }
    };

    for (const part of parts.reverse()) {
        value = {
            kind: 'ObjectValue',
            fields: [{
                kind: 'ObjectField',
                value,
                name: {
                    kind: 'Name',
                    value: part
                }
            }]
        }
    }

    return {
        kind: 'Argument',
        name: {
            kind: 'Name',
            value: argName
        },
        value
    };
}