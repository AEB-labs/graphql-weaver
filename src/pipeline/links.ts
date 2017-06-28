import { ASTNode, FieldNode, GraphQLObjectType, TypeInfo, visit, visitWithTypeInfo } from 'graphql';
import { PipelineModule } from './pipeline-module';
import { SchemaLinkTransformer } from '../graphql/links';
import { ExtendedSchema } from '../extended-schema/extended-schema';
import { transformExtendedSchema } from '../extended-schema/extended-schema-transformer';

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
