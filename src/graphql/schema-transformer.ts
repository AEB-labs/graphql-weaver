import {
    GraphQLArgument,
    GraphQLDirective,
    GraphQLEnumType, GraphQLEnumTypeConfig, GraphQLEnumValueConfigMap, GraphQLFieldConfig,
    GraphQLFieldConfigArgumentMap, GraphQLFieldConfigMap, GraphQLFieldMap, GraphQLInputFieldConfig,
    GraphQLInputFieldConfigMap, GraphQLInputObjectType, GraphQLInputObjectTypeConfig, GraphQLInputType,
    GraphQLInterfaceType, GraphQLInterfaceTypeConfig, GraphQLList, GraphQLNamedType, GraphQLNonNull, GraphQLObjectType,
    GraphQLObjectTypeConfig, GraphQLOutputType, GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig,
    GraphQLSchema, GraphQLType, GraphQLUnionType, GraphQLUnionTypeConfig
} from 'graphql';
import { isNativeGraphQLType } from './native-types';
import { GraphQLDirectiveConfig } from 'graphql/type/directives';

type TransformationFunction<TConfig, TContext extends SchemaTransformationContext>
    = (config: TConfig, context: TContext) => void;
type SimpleTransformationFunction<TConfig> = TransformationFunction<TConfig, SchemaTransformationContext>;

/**
 * An set of transformation functions that can alter parts of a schema
 */
export interface SchemaTransformer {
    transformScalarType?: SimpleTransformationFunction<GraphQLScalarTypeConfig<any, any>>;
    transformEnumType?: SimpleTransformationFunction<GraphQLEnumTypeConfig>;
    transformInterfaceType?: SimpleTransformationFunction<GraphQLInterfaceTypeConfig<any, any>>;
    transformInputObjectType?: SimpleTransformationFunction<GraphQLInputObjectTypeConfig>;
    transformUnionType?: SimpleTransformationFunction<GraphQLUnionTypeConfig<any, any>>;
    transformObjectType?: SimpleTransformationFunction<GraphQLObjectTypeConfig<any, any>>;
    transformDirective?: SimpleTransformationFunction<GraphQLDirectiveConfig>;

    transformField?: TransformationFunction<GraphQLNamedFieldConfig<any, any>, FieldTransformationContext>;
    transformInputField?: TransformationFunction<GraphQLNamedInputFieldConfig, InputFieldTransformationContext>;
}

export interface SchemaTransformationContext {
    /**
     * Finds a type of the new schema that corresponds to the given type in the old schema
     * @param type
     */
    mapType(type: GraphQLType): GraphQLType;
}

interface FieldTransformationContext extends SchemaTransformationContext {
    /**
     * Gets the type (in the new schema) that defined the field being transformed
     */
    readonly newOuterType: GraphQLObjectType | GraphQLInterfaceType;

    /**
     * Gets the type (in the old schema) that defined the field being transformed
     */
    readonly oldOuterType: GraphQLObjectType | GraphQLInterfaceType;
}

interface InputFieldTransformationContext extends SchemaTransformationContext {
    /**
     * Gets the type (in the new schema) that defined the field being transformed
     */
    readonly newOuterType: GraphQLInputObjectType;

    /**
     * Gets the type (in the old schema) that defined the field being transformed
     */
    readonly oldOuterType: GraphQLInputObjectType;
}

interface GraphQLNamedFieldConfig<TSource, TContext> extends GraphQLFieldConfig<TSource, TContext> {
    name: string;
}

interface GraphQLNamedInputFieldConfig extends GraphQLInputFieldConfig {
    name: string;
}

function combineTransformationFunctions<TConfig, TContext extends SchemaTransformationContext>
    (fns: (TransformationFunction<TConfig, TContext> | undefined)[]): TransformationFunction<TConfig, TContext> | undefined {
    const definedFns = fns.filter(a => a);
    if (!definedFns.length) {
        return undefined;
    }
    return (config, context) => {
        definedFns.forEach(fn => fn!(config, context));
    };
}

function bind<TConfig, TContext extends SchemaTransformationContext>(fn: TransformationFunction<TConfig, TContext> | undefined, obj: any):
    TransformationFunction<TConfig, TContext> | undefined {
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
    const transformer = new Transformer(transformers);
    return transformer.transform(schema);
}

class Transformer {
    private typeMap: { [typeName: string]: GraphQLNamedType } = {};

    constructor(private transformers: SchemaTransformer) {

    }

    public transform(schema: GraphQLSchema): GraphQLSchema {
        const originalTypes = Object.values(schema.getTypeMap());
        const originalInterfaces = originalTypes.filter(t => t instanceof GraphQLInterfaceType);

        // Dependencies between fields and their are broken up via GraphQL's thunk approach (fields are only requested when
        // needed, which is after all types have been converted). However, an object's reference to its implemented
        // interfaces does not support the thunk approach, so we need to make sure they are transformed first
        originalInterfaces.filter(t => t instanceof GraphQLInterfaceType).forEach(t => this.processType(t));
        originalTypes.filter(t => !(t instanceof GraphQLInterfaceType)).forEach(t => this.processType(t));

        return new GraphQLSchema({
            types: Object.values(this.typeMap),
            directives: schema.getDirectives().map(directive => this.transformDirective(directive)),
            query: this.findNewTypeMaybe(schema.getQueryType())!,
            mutation: this.findNewTypeMaybe(schema.getMutationType()),
            subscription: this.findNewTypeMaybe(schema.getSubscriptionType())
        });
    }

    /**
     * Finds the type in the new schema by its name in the old schema
     * @param name the old type name
     * @returns {GraphQLNamedType}
     */
    private findType(name: string) {
        if (!(name in this.typeMap)) {
            throw new Error(`Unexpected reference to type ${name} which has not (yet) been renamed`);
        }
        return this.typeMap[name];
    }

    /**
     * Maps a type in the old schema to a type in the new schema, supporting list and optional types.
     */
    private remapType<T extends GraphQLType>(type: T): T {
        if (type instanceof GraphQLList) {
            return <T>new GraphQLList(this.remapType(type.ofType));
        }
        if (type instanceof GraphQLNonNull) {
            return <T>new GraphQLNonNull(this.remapType(type.ofType));
        }
        const namedType = <GraphQLNamedType>type; // generics seem to throw off type guard logic
        if (isNativeGraphQLType(namedType)) {
            // do not rename native types but keep the reference to singleton objects like GraphQLString
            return type;
        }
        return <T>this.findType(namedType.name);
    }

    /**
     * Finds the new type corresponding to the old type, or undefined if undefined is given
     */
    private findNewTypeMaybe(type: GraphQLObjectType | undefined) {
        if (!type) {
            return undefined;
        }
        const newType = this.findType(type.name);
        return <GraphQLObjectType>newType;
    }

    private get transformationContext(): SchemaTransformationContext {
        return {
            mapType: this.remapType
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
        const config: GraphQLScalarTypeConfig<any, any> = {
            name: type.name,
            description: type.description,
            serialize: type.serialize.bind(type),
            parseLiteral: type.parseLiteral.bind(type),
            parseValue: type.parseValue.bind(type)
        };
        if (this.transformers.transformScalarType) {
            this.transformers.transformScalarType(config, this.transformationContext);
        }
        return new GraphQLScalarType(config);
    }

    private transformObjectType(type: GraphQLObjectType) {
        const config = {
            name: type.name,
            description: type.description,
            fields: () => this.transformFields(type.getFields(), {
                ...this.transformationContext,
                oldOuterType: type,
                newOuterType: this.remapType(type)
            }),
            interfaces: type.getInterfaces().map(iface => this.remapType(iface))
        };
        if (this.transformers.transformObjectType) {
            this.transformers.transformObjectType(config, this.transformationContext);
        }
        return new GraphQLObjectType(config);
    }

    private transformInterfaceType(type: GraphQLInterfaceType) {
        const config = {
            name: type.name,
            description: type.description,

            fields: () => this.transformFields(type.getFields(), {
                ...this.transformationContext,
                oldOuterType: type,
                newOuterType: this.remapType(type)
            }),

            // this is likely not to work, so it should be overwritten later, but it's our best choice. Leaving it null
            // will cause the schema invariants to fail (either resolveType or isTypeOf needs to be implemented)
            resolveType: !type.resolveType ? undefined :
                (value: any, context: any, info: GraphQLResolveInfo) => type.resolveType(value, context, info)
        };
        if (this.transformers.transformInterfaceType) {
            this.transformers.transformInterfaceType(config, this.transformationContext);
        }
        return new GraphQLInterfaceType(config);
    }

    /**
     * Creates field configs for all provided fields, but with remapped types and argument types. All named
     * types are sent through the typeResolver with their old name to determine the new type.
     */
    private transformFields(originalFields: GraphQLFieldMap<any, any>, context: FieldTransformationContext): GraphQLFieldConfigMap<any, any> {
        const fields: GraphQLFieldConfigMap<any, any> = {};
        for (const fieldName in originalFields) {
            const originalField = originalFields[fieldName];
            const fieldConfig: GraphQLNamedFieldConfig<any, any> = {
                name: fieldName,
                description: originalField.description,
                deprecationReason: originalField.deprecationReason,
                type: this.remapType(originalField.type),
                args: this.transformArguments(originalField.args)
            };
            if (this.transformers.transformField) {
                this.transformers.transformField(fieldConfig, context);
            }
            if (fieldConfig.name in fields) {
                throw new Error(`Duplicate field name ${fieldConfig} in ${context.oldOuterType.name}`);
            }
            fields[fieldConfig.name] = fieldConfig;
        }
        return fields;
    }

    private transformArguments(originalArgs: GraphQLArgument[]): GraphQLFieldConfigArgumentMap {
        const args: GraphQLFieldConfigArgumentMap = {};
        for (const arg of originalArgs) {
            args[arg.name] = {
                description: arg.description,
                type: this.remapType(arg.type),
                defaultValue: arg.defaultValue
            };
        }
        return args;
    }

    private transformInputObjectType(type: GraphQLInputObjectType) {
        const originalFields = type.getFields();

        const getFields = () => {
            const fields: GraphQLInputFieldConfigMap = {};
            for (const fieldName in originalFields) {
                const originalField = originalFields[fieldName];
                const fieldConfig = {
                    name: fieldName,
                    description: originalField.description,
                    defaultValue: originalField.defaultValue,
                    type: this.remapType(originalField.type)
                };
                if (this.transformers.transformInputField) {
                    this.transformers.transformInputField(fieldConfig, {
                        ...this.transformationContext,
                        oldOuterType: type,
                        newOuterType: this.remapType(type)
                    });
                }
                if (fieldConfig.name in fields) {
                    throw new Error(`Duplicate field name ${fieldConfig} in input type ${type.name}`);
                }
                fields[fieldConfig.name] = fieldConfig;
            }
            return fields;
        };

        const config = {
            name: type.name,
            description: type.description,
            fields: getFields
        };
        if (this.transformers.transformInputObjectType) {
            this.transformers.transformInputObjectType(config, this.transformationContext);
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

        const config = {
            name: type.name,
            description: type.description,
            values
        };
        if (this.transformers.transformEnumType) {
            this.transformers.transformEnumType(config, this.transformationContext);
        }
        return new GraphQLEnumType(config);
    }

    private transformUnionType(type: GraphQLUnionType) {
        const config: GraphQLUnionTypeConfig<any, any> = {
            name: type.name,
            description: type.description,
            types: type.getTypes().map(optionType => this.remapType(optionType))
        };
        if (this.transformers.transformUnionType) {
            this.transformers.transformUnionType(config, this.transformationContext);
        }
        return new GraphQLUnionType(config);
    }

    private transformDirective(directive: GraphQLDirective) {
        const config: GraphQLDirectiveConfig = {
            name: directive.name,
            description: directive.description,
            locations: directive.locations,
            args: this.transformArguments(directive.args)
        };
        if (this.transformers.transformDirective) {
            this.transformers.transformDirective(config, this.transformationContext);
        }
        return new GraphQLDirective(config);
    }
}
