import { ASTNode, FieldNode, GraphQLSchema, TypeInfo, visit, visitWithTypeInfo } from 'graphql';
import { LinkConfigMap } from '../config/proxy-configuration';
import { PipelineModule, PreMergeModuleContext } from './pipeline-module';
import { SchemaLinkTransformer } from '../graphql/links';
import { EndpointFactory } from '../endpoints/endpoint-factory';
import { transformSchema } from '../graphql/schema-transformer';
import { getTypePrefix } from '../graphql/renaming';

/**
 * Adds a feature to link fields to types of other endpoints
 */
export class LinksModule implements PipelineModule {
    private readonly links: LinkConfigMap;
    private schema: GraphQLSchema|undefined;

    constructor(private config: {
        endpoints: PreMergeModuleContext[], // TODO be more specific
        endpointFactory: EndpointFactory // TODO don't like this
    }) {
        this.links = this.getRenamedLinkMap();
    }

    private getRenamedLinkMap(): LinkConfigMap {
        const renamedLinkMap: LinkConfigMap = {};
        for (const endpoint of this.config.endpoints) {
            // copy the links from tne introspection schema into the config
            // This is pretty ugly as it modifies the config object. It would probably be better to have a separate step
            // to consolidate the provided JSON with all the introspection information
            for (const type of endpoint.extendedIntrospection._extIntrospection.types) {
                for (const field of type.fields) {
                    if (field.link) {
                        endpoint.endpointConfig.links[type.name + "." + field.name] = field.link;
                    }
                }
            }

            for (const linkName in endpoint.endpointConfig.links) {
                renamedLinkMap[getTypePrefix(endpoint.endpointConfig) + linkName] = endpoint.endpointConfig.links[linkName];
            }
        }
        return renamedLinkMap;
    }

    transformSchema(schema: GraphQLSchema): GraphQLSchema {
        this.schema = transformSchema(schema, new SchemaLinkTransformer({
            schema,
            links: this.links,
            endpoints: this.config.endpoints.map(e => e.endpointConfig),
            endpointFactory: this.config.endpointFactory
        }));

        return this.schema;
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
        if (!this.schema) {
            throw new Error(`Schema is not built yet`);
        }

        let layer = 0;
        const links = this.links;
        const typeInfo = new TypeInfo(this.schema);

        // first-level fields would be nested calls, there we want the link data
        const ignoreFirstLayer = node.kind != 'FragmentDefinition';

        return visit(node, visitWithTypeInfo(typeInfo, {
            Field: {
                enter(child: FieldNode) {
                    if (ignoreFirstLayer && layer < 2) {
                        layer++;
                        return;
                    }
                    layer++;
                    const type = typeInfo.getParentType();
                    if (!type) {
                        throw new Error(`Failed to retrieve type for field ${child.name.value}`);
                    }
                    const linkName = type.name + '.' + typeInfo.getFieldDef().name;
                    const link = links[linkName];
                    if (link) {
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
