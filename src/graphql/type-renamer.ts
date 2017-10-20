import { GraphQLSchema } from 'graphql';
import { SchemaTransformer, transformSchema } from 'graphql-transformer';

/**
 * Creates a new schema that equals the given one but with all names of non-native types transformed by a custom callback
 */
export function renameTypes(schema: GraphQLSchema, typeNameTransformer: (typeName: string) => string): GraphQLSchema {
    return transformSchema(schema, new TypeRenamingTransformer(typeNameTransformer));
}

/**
 * A schema transform that renames all no-native types according to a simple provided function
 */
export class TypeRenamingTransformer implements SchemaTransformer {
    constructor(private typeNameTransformer: (typeName: string) => string) {
    }

    transformEnumType = this.rename;
    transformInterfaceType = this.rename;
    transformObjectType = this.rename;
    transformScalarType = this.rename;
    transformUnionType = this.rename;
    transformInputObjectType = this.rename;
    transformDirective = this.rename;

    private rename<T extends { name: string }>(config: T): T {
        // ugly assertions needed until typescript 2.5, waiting for https://github.com/Microsoft/TypeScript/issues/10727
        return {
            ...(config as object),
            name: this.typeNameTransformer(config.name)
        } as T;
    }
}
