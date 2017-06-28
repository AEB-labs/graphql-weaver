import { PipelineModule } from './pipeline-module';
import {
    ASTNode, GraphQLInterfaceTypeConfig, GraphQLObjectType, GraphQLObjectTypeConfig, GraphQLTypeResolver,
    GraphQLUnionTypeConfig, SelectionSetNode, visit
} from 'graphql';
import { SchemaTransformationContext, SchemaTransformer } from '../graphql/schema-transformer';

/**
 * Ensures that resolveType in abstract types works correctly
 */
export class AbstractTypesModule implements PipelineModule {
    getSchemaTransformer() {
        return new TypeResolversTransformer();
    }

    transformNode(node: ASTNode) {
        // The default implementation of resolveType of an interface looks at __typename.
        // Thus, it is simplest to just request that field whenever there is a fragment
        // This will cause a collision if the user requests a different field under __typename alias
        // This also means that the result always includes __typename if fragments are used, even when not requested
        return visit(node, {
            SelectionSet(node: SelectionSetNode) {
                // TODO we also need to fetch the __typename if the outer type is abstract (don't know why, but GraphQL demands it)
                // this means we need a TypeInfo. Might be worth running the TypeInfo thing once and plug in multiple visitors
                const requiresTypename = node.selections.some(sel => sel.kind == 'FragmentSpread' || sel.kind == 'InlineFragment');
                const requestsTypename = node.selections.some(sel => sel.kind == 'Field' && sel.name.value == '__typename');
                const isTypenameAilased = node.selections.some(sel => sel.kind == 'Field' && sel.name.value != '__typename' && !!sel.alias && sel.alias.value == '__typename');
                if (isTypenameAilased) {
                    throw new Error(`Fields must not be aliased to __typename because this is a reserved field.`);
                }
                if (requiresTypename && !requestsTypename) {
                    return {
                        ...node,
                        selections: [
                            ...node.selections,
                            {
                                kind: 'Field',
                                name: {
                                    kind: 'Name',
                                    value: '__typename'
                                }
                            }
                        ]
                    };
                }
                return undefined;
            }
        });
    }
}


/**
 * A transformer that adds type resolvers to abstract types. They will assume the __typename field is fetched and use
 * that to locate the concrete type.
 */
class TypeResolversTransformer implements SchemaTransformer {
    transformObjectType(config: GraphQLObjectTypeConfig<any, any>): GraphQLObjectTypeConfig<any, any> {
        return {
            ...config,
            isTypeOf: undefined
        };
    }

    // this could be one type declaration with a generic type, but waiting for object spread on generic types
    // https://github.com/Microsoft/TypeScript/issues/10727

    transformInterfaceType(config: GraphQLInterfaceTypeConfig<any, any>, context: SchemaTransformationContext): GraphQLInterfaceTypeConfig<any, any> {
        return {
            ...config,
            resolveType: this.getResolver(config.name, context)
        }
    };

    transformUnionType(config: GraphQLUnionTypeConfig<any, any>, context: SchemaTransformationContext): GraphQLUnionTypeConfig<any, any> {
        return {
            ...config,
            resolveType: this.getResolver(config.name, context)
        }
    };

    getResolver(abstractTypeName: string, context: SchemaTransformationContext): GraphQLTypeResolver<any, any> {
        return async obj => {
            if (!('__typename' in obj)) {
                throw new Error(`__typename does not exist on fetched object of abstract type ${abstractTypeName}`);
            }

            // endpoint mapping and type prefixes should be taken care of in the links and type-prefixes modules
            const name = obj.__typename;
            const type = context.findType(name);
            if (!type) {
                throw new Error(`__typename of abstract type ${abstractTypeName} is set to ${JSON.stringify(name)}, ` +
                    `but there is no type with that name`);
            }
            if (!(type instanceof GraphQLObjectType)) {
                throw new Error(`__typename of abstract type ${abstractTypeName} is set to ${JSON.stringify(name)}, ` +
                    `but that is a ${type.constructor.name} and not a GraphQLObjectType.`);
            }
            return type;
        };
    }
}
