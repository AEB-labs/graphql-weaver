import {
    GraphQLFieldConfigMap, GraphQLInt, GraphQLObjectType, GraphQLObjectTypeConfig, GraphQLSchema, GraphQLString,
    GraphQLUnionType
} from 'graphql';
import {
    FieldsTransformationContext, GraphQLNamedFieldConfig, transformSchema
} from '../../src/graphql/schema-transformer';
import { walkFields } from '../../src/graphql/schema-utils';

describe('schema-transformer', () => {
    it('can copy types', () => {
        const type1 = new GraphQLObjectType({
            name: 'Type1',
            fields: {
                scalar: {
                    type: GraphQLString
                }
            }
        });

        const schema = new GraphQLSchema({
            query: new GraphQLObjectType({
                name: 'Query',
                fields: {
                    field1: {
                        type: type1
                    }
                }
            })
        });

        const newSchema = transformSchema(schema, {
            transformFields(config: GraphQLFieldConfigMap<any, any>, context: FieldsTransformationContext) {
                if (context.oldOuterType.name == 'Query') {
                    const field1 = config['field1'];

                    const type2 = context.copyType(field1.type, {
                        transformObjectType(typeConfig: GraphQLObjectTypeConfig<any, any>) {
                            return {
                                ...typeConfig,
                                name: 'Type2'
                            };
                        },

                        transformFields(fieldConfig: GraphQLFieldConfigMap<any, any>) {
                            return {
                                ...fieldConfig,
                                clone: {
                                    type: GraphQLInt,
                                    resolve: () => 42
                                }
                            };
                        }
                    });

                    return {
                        ...config,
                        field2: {
                            type: type2
                        }
                    };
                }

                return config;
            }
        });

        expect(walkFields(newSchema.getQueryType(), ['field1', 'scalar'])).toBeDefined('type1.scalar is missing');
        expect(walkFields(newSchema.getQueryType(), ['field2', 'scalar'])).toBeDefined('type2.scalar is missing');
        expect(walkFields(newSchema.getQueryType(), ['field1', 'clone'])).toBeUndefined('type2.clone should not be there');
        expect(walkFields(newSchema.getQueryType(), ['field2', 'clone'])).toBeDefined('type2.clone is missing');
    });

    it('supports union types', () => {
        const option1 = new GraphQLObjectType({
            name: 'Option1',
            fields: {option1: {type: GraphQLInt}},
            isTypeOf: (obj) => { return 'option1' in obj; }
        });
        const option2 = new GraphQLObjectType({
            name: 'Option2',
            fields: {option2: {type: GraphQLInt}},
            isTypeOf: (obj) => { return 'option1' in obj; }
        });

        const schema = new GraphQLSchema({
            query: new GraphQLObjectType({
                name: 'Query',
                fields: {
                    union: {
                        type: new GraphQLUnionType({
                            name: 'Union',
                            types: [ option1, option2 ]
                        })
                    }
                }
            })
        });

        const newSchema = transformSchema(schema, {
            transformField(config: GraphQLNamedFieldConfig<any, any>) {
                return {
                    ...config,
                    name: config.name + '_'
                };
            }
        });
        const unionType = newSchema.getQueryType().getFields()['union_'].type;
        expect(unionType instanceof GraphQLUnionType).toBeTruthy();
        expect((unionType as GraphQLUnionType).getTypes().length).toBe(2);
    });

    it('supports the README case', () => {
        const myType = new GraphQLObjectType({
            name: 'MyType',
            fields: {
                name: {
                    type: GraphQLString
                }
            }
        });

        const originalSchema = new GraphQLSchema({
            query: new GraphQLObjectType({
                name: 'Query',
                fields: {
                    myField: {
                        type: myType
                    }
                }
            })
        });

        const transformedSchema = transformSchema(originalSchema, {
            transformField(field: GraphQLNamedFieldConfig<any, any>, context) {
                // Rename a field in a type
                if (context.oldOuterType.name == 'MyType') {
                    return {
                        ...field,
                        name: field.name + 'ButCooler'
                    }
                }
                return field;
            },

            transformObjectType(type: GraphQLObjectTypeConfig<any, any>) {
                if (type.name == 'MyType') {
                    return {
                        ...type,
                        name: 'MyCoolType'
                    };
                }
                return type;
            },

            transformFields(fields: GraphQLFieldConfigMap<any, any>, context) {
                // You can even copy types on the fly and transform the copies
                const type2 = context.copyType(context.oldOuterType, {
                    transformObjectType(typeConfig: GraphQLObjectTypeConfig<any, any>) {
                        return {
                            ...typeConfig,
                            name: typeConfig.name + '2'
                        };
                    }
                });

                // This just adds a reflexive field "self" to all types, but its type does not have
                // the "self" field (because it is a copy from the original type, see above)
                // it also won't have the "cool" rename applied because the top-level transformers are not applied
                return {
                    ...fields,
                    self: {
                        type: type2,
                        resolve: (source: any) => source
                    }
                }
            }
        });

        const myTypeRes = transformedSchema.getQueryType().getFields()['myField'].type as GraphQLObjectType;
        expect(myTypeRes).toBeDefined();
        expect(myTypeRes.getFields()['nameButCooler']).toBeDefined();
        expect(myTypeRes.getFields()['self']).toBeDefined();
        const reflexiveTypeRes = myTypeRes.getFields()['self'].type as GraphQLObjectType;
        expect(reflexiveTypeRes.name).toBe('MyType2');
        expect(reflexiveTypeRes.getFields()['self']).not.toBeDefined();
        expect(reflexiveTypeRes.getFields()['name']).toBeDefined();
    })
});
