import { EndpointConfig, LinkConfigMap, ProxyConfig } from '../config/proxy-configuration';
import {
    ArgumentNode,
    buildClientSchema, getNamedType, GraphQLFieldConfig, GraphQLObjectType, GraphQLSchema, GraphQLType,
    IntrospectionQuery,
    introspectionQuery,
    isCompositeType,
    OperationTypeNode, SelectionSetNode, VariableDefinitionNode
} from 'graphql';
import fetch from 'node-fetch';
import { renameTypes, TypeRenamingTransformer } from './type-renamer';
import { mergeSchemas } from './schema-merger';
import {
    combineTransformers, FieldTransformationContext, GraphQLNamedFieldConfig, SchemaTransformer, transformSchema
} from './schema-transformer';
import { createResolver } from './proxy-resolver';
import TraceError = require('trace-error');

const ENDPOINT_TYPE_SEPARATOR = '_';

export async function createSchema(config: ProxyConfig) {
    const endpoints = await Promise.all(config.endpoints.map(async endpoint => {
        return {
            name: endpoint.name,
            config: endpoint,
            schema: await fetchSchema(endpoint.url)
        };
    }));

    const renamedLinkMap: LinkConfigMap = {};
    for (const endpoint of endpoints) {
        for (const linkName in endpoint.config.links) {
            renamedLinkMap[endpoint.name + ENDPOINT_TYPE_SEPARATOR + linkName] = endpoint.config.links[linkName];
        }
    }

    const renamedSchemas = endpoints.map(endpoint => {
        const prefix = endpoint.name + ENDPOINT_TYPE_SEPARATOR;
        const typeRenamer = (type: string) => prefix + type;
        const reverseTypeRenamer = getReverseTypeRenamer(endpoint.config);
        const baseResolverConfig = {
            url: endpoint.config.url,
            typeRenamer: reverseTypeRenamer,
            links: renamedLinkMap
        };
        return {
            schema: renameTypes(endpoint.schema, typeRenamer),
            namespace: endpoint.name,
            queryResolver: createResolver({...baseResolverConfig, operation: 'query'}),
            mutationResolver: createResolver({...baseResolverConfig, operation: 'mutation'}),
            subscriptionResolver: createResolver({...baseResolverConfig, operation: 'subscription'})
        };
    });
    const mergedSchema = mergeSchemas(renamedSchemas);
    const linkedSchema = transformSchema(mergedSchema, new SchemaLinkTransformer(endpoints.map(e => e.config), mergedSchema, renamedLinkMap));

    return linkedSchema;
}

class SchemaLinkTransformer implements SchemaTransformer {
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
                                                createArgumentWithVariableNode(link.argument, varName)
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
            const prefix = endpoint.name + ENDPOINT_TYPE_SEPARATOR;
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

function createArgumentWithVariableNode(argumentName: string, variableName: string): ArgumentNode {
    return {
        kind: 'Argument',
        name: {
            kind: 'Name',
            value: argumentName
        },
        value: {
            kind: 'Variable',
            name: {
                kind: 'Name',
                value: variableName
            }
        }
    };
}

function getReverseTypeRenamer(endpoint: EndpointConfig) {
    const prefix = endpoint.name + ENDPOINT_TYPE_SEPARATOR;
    return (type: string) => {
        if (type.startsWith(prefix)) {
            return type.substr(prefix.length);
        }
        return type;
    };
}

async function fetchSchema(url: string) {
    let introspection = await doIntrospectionQuery(url);
    try {
        return buildClientSchema(introspection);
    } catch (error) {
        throw new TraceError(`Failed to build schema from introspection result of ${url}: ${error.message}`, error);
    }
}

async function doIntrospectionQuery(url: string): Promise<IntrospectionQuery> {
    // TODO use a graphql client lib

    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: introspectionQuery
            })
        });
    } catch (error) {
        throw new TraceError(`Error fetching introspection result from ${url}: ${error.message}`, error);
    }
    if (!res.ok) {
        throw new Error(`Error fetching introspection result from ${url}: ${res.statusText}`);
    }
    const json = await res.json<any>();
    if ('errors' in json) {
        throw new Error(`Introspection query on ${url} failed: ${JSON.stringify((<any>json).errors)}`);
    }
    return json.data;
}
