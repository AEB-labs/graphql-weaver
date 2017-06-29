import {
    GraphQLArgument, GraphQLDirective, GraphQLEnumType, GraphQLEnumTypeConfig, GraphQLEnumValueConfigMap, GraphQLField,
    GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLFieldConfigMap, GraphQLFieldMap, GraphQLInputField,
    GraphQLInputFieldConfig, GraphQLInputFieldConfigMap, GraphQLInputObjectType, GraphQLInputObjectTypeConfig,
    GraphQLInterfaceType, GraphQLInterfaceTypeConfig, GraphQLList, GraphQLNamedType, GraphQLNonNull, GraphQLObjectType,
    GraphQLObjectTypeConfig, GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig, GraphQLSchema, GraphQLType,
    GraphQLTypeResolver, GraphQLUnionType, GraphQLUnionTypeConfig
} from 'graphql';
import { isNativeDirective, isNativeGraphQLType } from './native-symbols';
import { GraphQLDirectiveConfig } from 'graphql/type/directives';
import { compact, objectValues } from '../utils/utils';

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
    const definedFns = compact(fns.filter(a => a));
    if (!definedFns.length) {
        return undefined;
    }
    return (config, context) => definedFns.reduce((config, fn) => fn(config, context), config);
}

function bind<TConfig, TContext extends SchemaTransformationContext>(fn: TransformationFunction<TConfig, TContext> | undefined, obj: any): TransformationFunction<TConfig, TContext> | undefined {
    return fn ? fn.bind(obj) : fn;
}

/**
 * Combines multiple transformers that into one that executes the transformation functions in the given order
 */
export function combineTransformers(...transformers: SchemaTransformer[]): SchemaTransformer {
    return {
        transformScalarType: combineTransformationFunctions(transformers.map(t => bind(t.transformScalarType, t))),
        transformEnumType: combineTransformationFunctions(transformers.map(t => bind(t.transformEnumType, t))),
        transformInterfaceType: combineTransformationFunctions(transformers.map(t => bind(t.transformInterfaceType, t))),
        transformInputObjectType: combineTransformationFunctions(transformers.map(t => bind(t.transformInputObjectType, t))),
        transformUnionType: combineTransformationFunctions(transformers.map(t => bind(t.transformUnionType, t))),
        transformObjectType: combineTransformationFunctions(transformers.map(t => bind(t.transformObjectType, t))),
        transformDirective: combineTransformationFunctions(transformers.map(t => bind(t.transformDirective, t))),
        transformField: combineTransformationFunctions(transformers.map(t => bind(t.transformField, t))),
        transformInputField: combineTransformationFunctions(transformers.map(t => bind(t.transformInputField, t)))
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
            .map(directive => isNativeDirective(directive) ? directive : this.transformDirective(directive));

        const findNewTypeMaybe = (type: GraphQLObjectType | null | undefined) => {
            if (!type) {
                return undefined;
            }
            const newType = this.findType(type.name);
            return <GraphQLObjectType>newType;
        };

        return new GraphQLSchema({
            types: objectValues(this.typeMap),
            directives,
            query: findNewTypeMaybe(schema.getQueryType())!,
            mutation: findNewTypeMaybe(schema.getMutationType()),
            subscription: findNewTypeMaybe(schema.getSubscriptionType())
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
            oldSchema: this.schema
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
    private transformType(type: GraphQLNamedType) {
        if (type instanceof GraphQLScalarType) {
            return this.transformScalarType(type);
        }
        if (type instanceof GraphQLObjectType) {
            return this.transformObjectType(type);
        }
        if (type instanceof GraphQLInputObjectType) {
            return this.transformInputObjectType(type);
        }
        if (type instanceof GraphQLInterfaceType) {
            return this.transformInterfaceType(type);
        }
        if (type instanceof GraphQLUnionType) {
            return this.transformUnionType(type);
        }
        if (type instanceof GraphQLEnumType) {
            return this.transformEnumType(type);
        }
        throw new Error(`Unsupported type: ${type}`);
    }

    private transformScalarType(type: GraphQLScalarType) {
        let config: GraphQLScalarTypeConfig<any, any> = {
            name: type.name,
            description: type.description,
            serialize: type.serialize.bind(type),
            parseLiteral: type.parseLiteral.bind(type),
            parseValue: type.parseValue.bind(type)
        };
        if (this.transformers.transformScalarType) {
            config = this.transformers.transformScalarType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLScalarType(config);
    }

    private transformObjectType(type: GraphQLObjectType) {
        let config: GraphQLObjectTypeConfig<any, any> = {
            name: type.name,
            description: type.description,
            fields: () => this.transformFields(type.getFields(), <{ oldOuterType: GraphQLObjectType | GraphQLInterfaceType, newOuterType: GraphQLObjectType | GraphQLInterfaceType}>{
                ...this.transformationContext,
                oldOuterType: type,
                newOuterType: this.mapType(type)
            }),
            interfaces: type.getInterfaces().map(iface => this.mapType(iface))
        };
        if (this.transformers.transformObjectType) {
            config = this.transformers.transformObjectType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLObjectType(config);
    }

    private transformInterfaceType(type: GraphQLInterfaceType) {
        let config: GraphQLInterfaceTypeConfig<any, any> = {
            name: type.name,
            description: type.description,
            resolveType: this.transformTypeResolver(type.resolveType),

            fields: () => this.transformFields(type.getFields(), {
                oldOuterType: type,
                newOuterType: this.mapType(type)
            })
        };
        if (this.transformers.transformInterfaceType) {
            config = this.transformers.transformInterfaceType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLInterfaceType(config);
    }

    /**
     * Creates field configs for all provided fields, but with remapped types and argument types. All named
     * types are sent through the typeResolver with their old name to determine the new type.
     */
    private transformFields(originalFields: GraphQLFieldMap<any, any>, context: { oldOuterType: GraphQLObjectType | GraphQLInterfaceType, newOuterType: GraphQLObjectType | GraphQLInterfaceType}): GraphQLFieldConfigMap<any, any> {
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
            if (this.transformers.transformField) {
                fieldConfig = this.transformers.transformField(fieldConfig, {
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
        if (this.transformers.transformFields) {
            fields = this.transformers.transformFields(fields, {
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

    private transformInputObjectType(type: GraphQLInputObjectType) {
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
                if (this.transformers.transformInputField) {
                    fieldConfig = this.transformers.transformInputField(fieldConfig, {
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
        if (this.transformers.transformInputObjectType) {
            config = this.transformers.transformInputObjectType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLInputObjectType(config);
    }

    private transformEnumType(type: GraphQLEnumType) {
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
        if (this.transformers.transformEnumType) {
            config = this.transformers.transformEnumType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLEnumType(config);
    }

    private transformUnionType(type: GraphQLUnionType) {
        let config: GraphQLUnionTypeConfig<any, any> = {
            name: type.name,
            description: type.description,
            types: type.getTypes().map(optionType => this.mapType(optionType)),
            resolveType: this.transformTypeResolver(type.resolveType)
        };
        if (this.transformers.transformUnionType) {
            config = this.transformers.transformUnionType(config, {...this.transformationContext, oldType: type});
        }
        return new GraphQLUnionType(config);
    }

    private transformDirective(directive: GraphQLDirective) {
        let config: GraphQLDirectiveConfig = {
            name: directive.name,
            description: directive.description,
            locations: directive.locations,
            args: this.transformArguments(directive.args)
        };
        if (this.transformers.transformDirective) {
            config = this.transformers.transformDirective(config, {...this.transformationContext, oldDirective: directive});
        }
        return new GraphQLDirective(config);
    }

    private transformTypeResolver(typeResolver: GraphQLTypeResolver<any, any>) {
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
