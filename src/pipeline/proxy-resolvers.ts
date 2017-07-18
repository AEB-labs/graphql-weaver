import {PipelineModule} from './pipeline-module';
import {FieldTransformationContext, GraphQLNamedFieldConfig, SchemaTransformer} from '../graphql/schema-transformer';
import {GraphQLResolveInfo, GraphQLSchema, GraphQLType, ResponsePath} from 'graphql';
import {getFieldAsQuery, getFieldAsQueryParts, getQueryFromParts} from '../graphql/field-as-query';
import {GraphQLEndpoint} from '../endpoints/graphql-endpoint';
import {Query} from '../graphql/common';
import {EndpointConfig} from '../config/proxy-configuration';
import {cloneSelectionChain, collectFieldNodesInPath, createSelectionChain} from '../graphql/language-utils';
import { isRootType, walkFields } from '../graphql/schema-utils';
import {collectAliasesInResponsePath} from "../graphql/resolver-utils";

interface Config {
    readonly endpoint: GraphQLEndpoint
    processQuery(query: Query, endpointIdentifier: string): Query
    readonly endpointConfig: EndpointConfig
}

/**
 * Adds resolvers to the top-level fields of all root types that proxy the request to a specified endpoint
 */
export class ProxyResolversModule implements PipelineModule {
    constructor(private readonly config: Config) {

    }

    getSchemaTransformer() {
        return new ResolverTransformer(this.config)
    }
}

class ResolverTransformer implements SchemaTransformer {
    constructor(private readonly config: Config) {

    }

    transformField(config: GraphQLNamedFieldConfig<any, any>, context: FieldTransformationContext): GraphQLNamedFieldConfig<any, any> {
        if (!isRootType(context.oldOuterType, context.oldSchema)) {
            return config;
        }

        return {
            ...config,
            resolve: async (source, args, context, info: GraphQLResolveInfo) => {
                const {selectionSet, ...parts} = getFieldAsQueryParts(info);

                // wrap selection into the field hierarchy from root to the field being resolved
                const aliases = collectAliasesInResponsePath(info.path);
                const fieldNodes = collectFieldNodesInPath(info.operation.selectionSet, aliases, info.fragments);
                // if the selection set is empty, this field node is of sclar type and does not have selections
                const newSelectionSet = cloneSelectionChain(fieldNodes, selectionSet.selections.length ? selectionSet : undefined);
                let query = getQueryFromParts({...parts, selectionSet: newSelectionSet});

                query = this.config.processQuery(query, this.config.endpointConfig.identifier!);

                const result = await this.config.endpoint.query(query.document, query.variableValues, context);
                const propertyOnResult = aliases[aliases.length - 1];
                if (typeof result != 'object' || !(propertyOnResult in result)) {
                    throw new Error(`Expected GraphQL endpoint to return object with ${propertyOnResult} property`)
                }
                return result[propertyOnResult];
            }
        };
    }
}
