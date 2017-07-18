import { PipelineModule } from './pipeline-module';
import {
    ASTNode,
    FieldNode, getNamedType, GraphQLInterfaceTypeConfig, GraphQLObjectType, GraphQLObjectTypeConfig, GraphQLSchema,
    GraphQLTypeResolver, GraphQLUnionTypeConfig, isAbstractType, SelectionSetNode, TypeInfo, visit, visitWithTypeInfo
} from 'graphql';
import { SchemaTransformationContext, SchemaTransformer, transformSchema } from '../graphql/schema-transformer';
import { Query } from '../graphql/common';
import { getAliasOrName } from '../graphql/language-utils';

/**
 * Ensures that resolveType in abstract types works correctly
 */
export class AbstractTypesModule implements PipelineModule {
    private schema: GraphQLSchema | undefined;

    transformSchema(schema: GraphQLSchema) {
        const newSchema = transformSchema(schema, new TypeResolversTransformer());
        this.schema = schema;
        return newSchema;
    }

    transformNode(document: ASTNode) {
        const typeInfo = new TypeInfo(this.schema!);

        // To determine the concrete type of an abstract type, we need to fetch the __typename field.
        // This is necessary even if it was not originally requested, e.g. for fragment support.
        // In addition, it seems graphqljs calls resolveType() even if none of these conditions are met, just to complete values properly
        // If __typename was not requested, graphql will drop it (more precisely, it will just not select it for the result)
        return visit(document, visitWithTypeInfo(typeInfo, {
            SelectionSet(node: SelectionSetNode) {
                const type = typeInfo.getType();
                if (!type) {
                    throw new Error(`Failed to determine type of SelectionSet node`);
                }

                if (!isAbstractType(getNamedType(type))) {
                    // only need __typename for abstract types
                    return undefined;
                }

                // this does not check if __typename is aliased in a fragment spread. That would cause a GraphQL error.
                // but seriously... nobody would do that. This saves the performance impact of traversing all fragment spreads
                const typenameRequest = node.selections.filter(sel => sel.kind == 'Field' && getAliasOrName(sel) == '__typename')[0] as FieldNode | undefined;
                if (typenameRequest) {
                    // make sure nothing else is requested as __typename
                    if (typenameRequest.name.value != '__typename') {
                        throw new Error(`Fields must not be aliased to __typename because this is a reserved field.`);
                    }
                    // __typename is requested, so no change needed
                    return undefined;
                }

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
        }));
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
        };
    };

    transformUnionType(config: GraphQLUnionTypeConfig<any, any>, context: SchemaTransformationContext): GraphQLUnionTypeConfig<any, any> {
        return {
            ...config,
            resolveType: this.getResolver(config.name, context)
        };
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
