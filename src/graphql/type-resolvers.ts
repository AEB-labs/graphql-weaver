import { SchemaTransformationContext, SchemaTransformer } from './schema-transformer';
import {
    GraphQLInterfaceTypeConfig, GraphQLObjectType, GraphQLObjectTypeConfig, GraphQLTypeResolver, GraphQLUnionTypeConfig
} from 'graphql';

/**
 * A transformer that adds type resolvers to abstract types. They will assume the __typename field is fetched and use
 * that to locate the concrete type.
 */
export class TypeResolversTransformer implements SchemaTransformer {
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
