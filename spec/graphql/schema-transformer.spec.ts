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
});
