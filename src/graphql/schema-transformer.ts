import {
    GraphQLArgument, GraphQLDirective, GraphQLEnumType, GraphQLEnumTypeConfig, GraphQLEnumValueConfigMap, GraphQLField,
    GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLFieldConfigMap, GraphQLFieldMap, GraphQLInputField,
    GraphQLInputFieldConfig, GraphQLInputFieldConfigMap, GraphQLInputObjectType, GraphQLInputObjectTypeConfig,
    GraphQLInterfaceType, GraphQLInterfaceTypeConfig, GraphQLList, GraphQLNamedType, GraphQLNonNull, GraphQLObjectType,
    GraphQLObjectTypeConfig, GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig, GraphQLSchema, GraphQLType,
    GraphQLTypeResolver, GraphQLUnionType, GraphQLUnionTypeConfig, isInputType
} from 'graphql';
import { isNativeDirective, isNativeGraphQLType } from './native-symbols';
import { GraphQLDirectiveConfig } from 'graphql/type/directives';
import { bindNullable, compact, objectValues } from '../utils/utils';

type TransformationFunction<TConfig, TContext extends SchemaTransformationContext>
    = (config: TConfig, context: TContext) => TConfig;

/**
 * An set of transformation functions that can alter parts of a schema
 */
export interface SchemaTransformer {
    transformScalarType?: TransformationFunction<GraphQLScalarTypeConfig<any, any>, TypeTransformationContext<GraphQLScalarType>>;
    transformEnumType?: TransformationFunction<GraphQLEnumTypeConfig, TypeTransformationContext<GraphQLEnumType>>;
    transformInterfaceType?: TransformationFunction<GraphQLInterfaceTypeConfig<any, any>, TypeTransformationContext<GraphQLInterfaceType>>;
    transformInputObjectType?: TransformationFunction<GraphQLInputObjectTypeConfig, TypeTransformationContext<GraphQLInputObjectType>>;
    transformUnionType?: TransformationFunction<GraphQLUnionTypeConfig<any, any>, TypeTransformationContext<GraphQLUnionType>>;
    transformObjectType?: TransformationFunction<GraphQLObjectTypeConfig<any, any>, TypeTransformationContext<GraphQLObjectType>>;
    transformDirective?: TransformationFunction<GraphQLDirectiveConfig, DirectiveTransformationContext>;

    transformField?: TransformationFunction<GraphQLNamedFieldConfig<any, any>, FieldTransformationContext>;
    transformFields?: TransformationFunction<GraphQLFieldConfigMap<any, any>, FieldsTransformationContext>;
    transformInputField?: TransformationFunction<GraphQLNamedInputFieldConfig, InputFieldTransformationContext>;
}

export interface SchemaTransformationContext {
    /**
     * Finds a type of the new schema that corresponds to the given type in the old schema
     * @param type
     */
    mapType<T extends GraphQLType>(type: T): T;

    /**
     * Finds a type of the new schema given its name in the old schema
     * @param name
     */
    findType(name: string): GraphQLNamedType | undefined;

    /**
     * Creates a new GraphQLType for a given type and passes it through custom transformer functions. The regular
     * transformer functions passed to transformSchema() are ignored.
     */
    copyType<T extends GraphQLType>(type: T, transformer: SchemaTransformer): T;

    readonly oldSchema: GraphQLSchema;
}

export interface TypeTransformationContext<T extends GraphQLType>  extends SchemaTransformationContext {
    /**
     * The original version of the type
     */
    readonly oldType: T;
}

export interface DirectiveTransformationContext extends SchemaTransformationContext {
    /**
     * The original version of the directive
     */
    readonly oldDirective: GraphQLDirective;
}

export interface FieldTransformationContext extends SchemaTransformationContext {
    /**
     * The original version of the field
     */
    readonly oldField: GraphQLField<any, any>;

    /**
     * Gets the type (in the new schema) that defined the field being transformed
     */
    readonly newOuterType: GraphQLObjectType | GraphQLInterfaceType;

    /**
     * Gets the type (in the old schema) that defined the field being transformed
     */
    readonly oldOuterType: GraphQLObjectType | GraphQLInterfaceType;
}

export interface FieldsTransformationContext extends SchemaTransformationContext {
    /**
     * The original version of the fields
     */
    readonly oldFields: GraphQLFieldMap<any, any>;

    /**
     * Gets the type (in the new schema) that defined the field being transformed
     */
    readonly newOuterType: GraphQLObjectType | GraphQLInterfaceType;

    /**
     * Gets the type (in the old schema) that defined the field being transformed
     */
    readonly oldOuterType: GraphQLObjectType | GraphQLInterfaceType;
}

export interface InputFieldTransformationContext extends SchemaTransformationContext {
    /**
     * The original version of the field
     */
    readonly oldField: GraphQLInputField;

    /**
     * Gets the type (in the new schema) that defined the field being transformed
     */
    readonly newOuterType: GraphQLInputObjectType;

    /**
     * Gets the type (in the old schema) that defined the field being transformed
     */
    readonly oldOuterType: GraphQLInputObjectType;
}

export interface GraphQLNamedFieldConfig<TSource, TContext> extends GraphQLFieldConfig<TSource, TContext> {
    name: string;
}

export interface GraphQLNamedInputFieldConfig extends GraphQLInputFieldConfig {
    name: string;
}

function combineTransformationFunctions<TConfig, TContext extends SchemaTransformationContext>
(fns: (TransformationFunction<TConfig, TContext> | undefined)[]): TransformationFunction<TConfig, TContext> | undefined {
    const definedFns = compact(fns);
    if (!definedFns.length) {
        return undefined;
    }
    return (config, context) => definedFns.reduce((config, fn) => fn(config, context), config);
}

/**
 * Binds all SchemaTransformer methods to the SchemaTransformer itself, effectively converting a class to a function tuple
 * @param {SchemaTransformer[]} t
 * @returns {SchemaTransformer}
 */
export function bindTransformerFunctions(t: SchemaTransformer): SchemaTransformer {
    return {
        transformScalarType: bindNullable(t.transformScalarType, t),
        transformEnumType: bindNullable(t.transformEnumType, t),
        transformInterfaceType: bindNullable(t.transformInterfaceType, t),
        transformInputObjectType: bindNullable(t.transformInputObjectType, t),
        transformUnionType: bindNullable(t.transformUnionType, t),
        transformObjectType: bindNullable(t.transformObjectType, t),
        transformDirective: bindNullable(t.transformDirective, t),
        transformField: bindNullable(t.transformField, t),
        transformInputField: bindNullable(t.transformInputField, t)
    };
}

/**
 * Combines multiple transformers that into one that executes the transformation functions in the given order
 */
export function combineTransformers(...transformers: SchemaTransformer[]): SchemaTransformer {
    const boundTransformers = transformers.map(t => bindTransformerFunctions(t));

    return {
        transformScalarType: combineTransformationFunctions(boundTransformers.map(t => t.transformScalarType)),
        transformEnumType: combineTransformationFunctions(boundTransformers.map(t => t.transformEnumType)),
        transformInterfaceType: combineTransformationFunctions(boundTransformers.map(t => t.transformInterfaceType)),
        transformInputObjectType: combineTransformationFunctions(boundTransformers.map(t => t.transformInputObjectType)),
        transformUnionType: combineTransformationFunctions(boundTransformers.map(t => t.transformUnionType)),
        transformObjectType: combineTransformationFunctions(boundTransformers.map(t => t.transformObjectType)),
        transformDirective: combineTransformationFunctions(boundTransformers.map(t => t.transformDirective)),
        transformField: combineTransformationFunctions(boundTransformers.map(t => t.transformField)),
        transformInputField: combineTransformationFunctions(boundTransformers.map(t => t.transformInputField))
    };
}

/**
 * Clones a GraphQLSchema by destructuring it into GraphQL's config objects and executes custom transformers
 * on these config objects
 *
 * @param schema
 * @param transformers
 */
export function transformSchema(schema: GraphQLSchema, transformers: SchemaTransformer) {
    const transformer = new Transformer(transformers, schema);
    return transformer.transform();
}

// this is not really an OOP class but it is useful to keep track of state. It is not exported, so this is fine
class Transformer {
    private typeMap: { [typeName: string]: GraphQLNamedType } = {};

    constructor(private readonly transformers: SchemaTransformer, private readonly schema: GraphQLSchema) {
    }

    /**
     * only call once
     */
    public transform(): GraphQLSchema {
        const schema = this.schema;

        // Dependencies between fields and their are broken up via GraphQL's thunk approach (fields are only requested when
        // needed, which is after all types have been converted). However, an object's reference to its implemented
        // interfaces does not support the thunk approach, so we need to make sure they are transformed first
        const originalTypes = objectValues(schema.getTypeMap());
        const orderedTypes = [
            ...originalTypes.filter(t => t instanceof GraphQLInterfaceType),
            ...originalTypes.filter(t => !(t instanceof GraphQLInterfaceType))
        ];
        for (const type of orderedTypes) {
            this.processType(type);
        }

        const directives = schema.getDirectives()
            .map(directive => isNativeDirective(directive) ? directive : this.transformDirective(directive, this.transformers));

        const findNewTypeMaybe = (type: GraphQLObjectType | null | undefined) => {
            if (!type) {
                return undefined;
            }
            const newType = this.findType(type.name);
            return <GraphQLObjectType>newType;
        };

        return new GraphQLSchema({
            directives,
            query: findNewTypeMaybe(schema.getQueryType())!,
            mutation: findNewTypeMaybe(schema.getMutationType()),
            subscription: findNewTypeMaybe(schema.getSubscriptionType()),

            // carry on object types, to avoid losing implementations of interfaces that are not referenced elsewhere
            // we don't need to carry on other types. This allows us to implicitly drop input types by no longer using them
            types: objectValues(this.typeMap).filter(type => type instanceof GraphQLObjectType)
        });
    }

    /**
     * Finds the type in the new schema by its name in the old schema
     * @param oldName the old type name
     * @returns {GraphQLNamedType}
     */
    private findType(oldName: string) {
        if (!(oldName in this.typeMap)) {
            throw new Error(`Unexpected reference to type ${oldName}`);
        }
        return this.typeMap[oldName];
    }

    /**
     * Maps a type in the old schema to a type in the new schema, supporting list and optional types.
     */
    private mapType<T extends GraphQLType>(type: T): T {
        if (type instanceof GraphQLList) {
            return <T>new GraphQLList(this.mapType(type.ofType));
        }
        if (type instanceof GraphQLNonNull) {
            return <T>new GraphQLNonNull(this.mapType(type.ofType));
        }
        const namedType = <GraphQLNamedType>type; // generics seem to throw off type guard logic
        if (isNativeGraphQLType(namedType)) {
            // do not rename native types but keep the reference to singleton objects like GraphQLString
            return type;
        }
        return <T>this.findType(namedType.name);
    }

    private get transformationContext(): SchemaTransformationContext {
        return {
            mapType: this.mapType.bind(this),
            findType: this.findType.bind(this),
            oldSchema: this.schema,
            copyType: this.copyType.bind(this)
        };
    }

    /**
     * Creates a new type for the given old type and stores it in the type map
     * @param type
     */
    private processType(type: GraphQLNamedType) {
        if (type.name.substring(0, 2) === '__' || isNativeGraphQLType(type)) {
            // do not touch native types or introspection types like __Schema
            return;
        }
        this.typeMap[type.name] = this.transformType(type);
    }

    /**
     * Creates a new type for the given old type. Interfaces are expected to be already present; fields are resolved lazily
     */
    private transformType<T extends GraphQLType>(type: T) {
        return this.copyType(type, this.transformers);
    }


    private copyType<T extends GraphQLType>(type: T, transformer: SchemaTransformer) {
        if (type instanceof GraphQLScalarType) {
            return this.transformScalarType(type, transformer);
        }
        if (type instanceof GraphQLObjectType) {
            return this.transformObjectType(type, transformer);
        }
        if (type instanceof GraphQLInputObjectType) {
            return this.transformInputObjectType(type, transformer);
        }
        if (type instanceof GraphQLInterfaceType) {
            return this.transformInterfaceType(type, transformer);
        }
        if (type instanceof GraphQLUnionType) {
            return this.transformUnionType(type, transformer);
        }
        if (type instanceof GraphQLEnumType) {
            return this.transformEnumType(type, transformer);
        }
        throw new Error(`Unsupported type: ${type}`);
    }

    private transformScalarType(type: GraphQLScalarType, transformer: SchemaTransformer) {
        let config: GraphQLScalarTypeConfig<any, any> = {
            name: type.name,
            description: type.description,
            serialize: type.serialize.bind(type),
            parseLiteral: type.parseLiteral.bind(type),
            parseValue: type.parseValue.bind(type)
        };
        if (transformer.transformScalarType) {
            config = transformer.transformScalarType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLScalarType(config);
    }

    private transformObjectType(type: GraphQLObjectType, transformer: SchemaTransformer) {
        let config: GraphQLObjectTypeConfig<any, any> = {
            name: type.name,
            description: type.description,
            fields: () => this.transformFields(type.getFields(), <{ oldOuterType: GraphQLObjectType | GraphQLInterfaceType, newOuterType: GraphQLObjectType | GraphQLInterfaceType}>{
                ...this.transformationContext,
                oldOuterType: type,
                newOuterType: this.mapType(type)
            }, transformer),
            interfaces: type.getInterfaces().map(iface => this.mapType(iface))
        };
        if (transformer.transformObjectType) {
            config = transformer.transformObjectType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLObjectType(config);
    }

    private transformInterfaceType(type: GraphQLInterfaceType, transformer: SchemaTransformer) {
        let config: GraphQLInterfaceTypeConfig<any, any> = {
            name: type.name,
            description: type.description,
            resolveType: this.transformTypeResolver(type.resolveType, transformer),

            fields: () => this.transformFields(type.getFields(), {
                oldOuterType: type,
                newOuterType: this.mapType(type)
            }, transformer)
        };
        if (transformer.transformInterfaceType) {
            config = transformer.transformInterfaceType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLInterfaceType(config);
    }

    /**
     * Creates field configs for all provided fields, but with remapped types and argument types. All named
     * types are sent through the typeResolver with their old name to determine the new type.
     */
    private transformFields(originalFields: GraphQLFieldMap<any, any>, context: { oldOuterType: GraphQLObjectType | GraphQLInterfaceType, newOuterType: GraphQLObjectType | GraphQLInterfaceType}, transformer: SchemaTransformer): GraphQLFieldConfigMap<any, any> {
        let fields: GraphQLFieldConfigMap<any, any> = {};
        for (const fieldName in originalFields) {
            const originalField = originalFields[fieldName];
            let fieldConfig: GraphQLNamedFieldConfig<any, any> = {
                name: fieldName,
                description: originalField.description,
                deprecationReason: originalField.deprecationReason,
                type: this.mapType(originalField.type),
                args: this.transformArguments(originalField.args),
                resolve: originalField.resolve
            };
            if (transformer.transformField) {
                fieldConfig = transformer.transformField(fieldConfig, {
                    ...this.transformationContext,
                    oldField: originalField,
                    oldOuterType: context.oldOuterType,
                    newOuterType: context.newOuterType
                });
            }
            if (fieldConfig.name in fields) {
                throw new Error(`Duplicate field name ${fieldConfig} in ${context.oldOuterType.name}`);
            }
            fields[fieldConfig.name] = fieldConfig;
        }
        if (transformer.transformFields) {
            fields = transformer.transformFields(fields, {
                ...this.transformationContext,
                oldFields: originalFields,
                oldOuterType: context.oldOuterType,
                newOuterType: context.newOuterType
            });
        }
        return fields;
    }

    private transformArguments(originalArgs: GraphQLArgument[]): GraphQLFieldConfigArgumentMap {
        const args: GraphQLFieldConfigArgumentMap = {};
        for (const arg of originalArgs) {
            args[arg.name] = {
                description: arg.description,
                type: this.mapType(arg.type),
                defaultValue: arg.defaultValue
            };
        }
        return args;
    }

    private transformInputObjectType(type: GraphQLInputObjectType, transformer: SchemaTransformer) {
        const getFields = () => {
            const originalFields = type.getFields();
            const fields: GraphQLInputFieldConfigMap = {};
            for (const fieldName in originalFields) {
                const originalField = originalFields[fieldName];
                let fieldConfig: GraphQLNamedInputFieldConfig = {
                    name: fieldName,
                    description: originalField.description,
                    defaultValue: originalField.defaultValue,
                    type: this.mapType(originalField.type)
                };
                if (transformer.transformInputField) {
                    fieldConfig = transformer.transformInputField(fieldConfig, {
                        ...this.transformationContext,
                        oldField: originalField,
                        oldOuterType: type,
                        newOuterType: this.mapType(type)
                    });
                }
                if (fieldConfig.name in fields) {
                    throw new Error(`Duplicate field name ${fieldConfig} in input type ${type.name}`);
                }
                fields[fieldConfig.name] = fieldConfig;
            }
            return fields;
        };

        let config: GraphQLInputObjectTypeConfig = {
            name: type.name,
            description: type.description,
            fields: getFields
        };
        if (transformer.transformInputObjectType) {
            config = transformer.transformInputObjectType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLInputObjectType(config);
    }

    private transformEnumType(type: GraphQLEnumType, transformer: SchemaTransformer) {
        const values: GraphQLEnumValueConfigMap = {};
        for (const originalValue of type.getValues()) {
            values[originalValue.name] = {
                description: originalValue.description,
                value: originalValue.value,
                deprecationReason: originalValue.deprecationReason
            };
        }

        let config: GraphQLEnumTypeConfig = {
            name: type.name,
            description: type.description,
            values
        };
        if (transformer.transformEnumType) {
            config = transformer.transformEnumType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLEnumType(config);
    }

    private transformUnionType(type: GraphQLUnionType, transformer: SchemaTransformer) {
        let config: GraphQLUnionTypeConfig<any, any> = {
            name: type.name,
            description: type.description,
            types: type.getTypes().map(optionType => this.mapType(optionType)),
            resolveType: this.transformTypeResolver(type.resolveType, transformer)
        };
        if (transformer.transformUnionType) {
            config = transformer.transformUnionType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLUnionType(config);
    }

    private transformDirective(directive: GraphQLDirective, transformer: SchemaTransformer) {
        let config: GraphQLDirectiveConfig = {
            name: directive.name,
            description: directive.description,
            locations: directive.locations,
            args: this.transformArguments(directive.args)
        };
        if (transformer.transformDirective) {
            config = transformer.transformDirective(config, {...this.transformationContext, oldDirective: directive});
        }
        return new GraphQLDirective(config);
    }

    private transformTypeResolver(typeResolver: GraphQLTypeResolver<any, any>, transformer: SchemaTransformer) {
        if (!typeResolver) {
            return typeResolver;
        }

        return (value: any, context: any, info: GraphQLResolveInfo) => {
            const result = typeResolver(value, context, info);
            if (typeof result == 'string') {
                return <GraphQLObjectType>this.findType(result);
            }
            if (result instanceof GraphQLObjectType) {
                return this.mapType(result);
            }
            return result.then(r => typeof r == 'string' ? <GraphQLObjectType>this.findType(r) : this.mapType(r));
        };
    }
}
