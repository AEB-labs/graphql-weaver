import { graphql, GraphQLFieldConfigMap, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { ExtendedSchema, FieldMetadata, LinkConfig, SchemaMetadata } from '../../src/extended-schema/extended-schema';
import {
    EXTENDED_INTROSPECTION_FIELD, EXTENDED_INTROSPECTION_TYPE_NAMES,
    ExtendedIntrospectionData, getExtendedIntrospectionData, getExtendedIntrospectionType
} from '../../src/extended-schema/extended-introspection';
import { fetchSchemaMetadata } from '../../src/extended-schema/fetch-metadata';
import { LocalEndpoint } from '../../src/endpoints/local-endpoint';
import { transformSchema } from '../../src/graphql/schema-transformer';
import { filterValues, objectFromKeys } from '../../src/utils/utils';
import { assertSuccessfulResult } from '../../src/graphql/execution-result';

describe('extended-introspection', () => {
    const fieldMetadata: FieldMetadata =  {
        link: {
            field: 'targetField',
            batchMode: true,
            keyField: 'keyField',
            argument: 'arg'
        }
    };

    function createSchemaWithIntrospection(fields: GraphQLFieldConfigMap<any, any>, metadata: SchemaMetadata) {
        const data = getExtendedIntrospectionData(metadata);
        return new GraphQLSchema({
            query: new GraphQLObjectType({
                name: 'Query',
                fields: {
                    ...fields,
                    [EXTENDED_INTROSPECTION_FIELD]: {
                        type: getExtendedIntrospectionType(),
                        resolve: () => data
                    }
                }
            })
        });
    }

    function createSimpleSchema() {
        const metadata = new SchemaMetadata();
        metadata.fieldMetadata.set('Query.field', fieldMetadata);

        return createSchemaWithIntrospection({
            field: {
                type: GraphQLString
            }
        }, metadata);
    }

    describe('ExtendedIntrospectionType', () => {
        it('creates valid GraphQL schema', () => {
            createSimpleSchema();
        });

        it('is compatible with a basic introspection query', async () => {
            // just to make sure we stay basically backwards-compatible
            // these constants here really should not change
            const schema = createSimpleSchema();
            const query = `{ _extIntrospection { types { name fields { name metadata { link { argument } } } } } }`;
            const result = await graphql(schema, query);
            assertSuccessfulResult(result);
        });
    });

    describe('fetchSchemaMetadata', () => {
        it('is compatible with ExtendedIntrospectionType', async () => {
            const schema = createSimpleSchema();
            const metadata = await fetchSchemaMetadata(new LocalEndpoint(schema), schema);
            expect(metadata.fieldMetadata.has('Query.field')).toBeTruthy('Query.field missing');
            expect(metadata.fieldMetadata.get('Query.field')).toEqual(fieldMetadata);
        });

        it('is compatible with older ExtendedIntrospectionType', async () => {
            const schema = createSimpleSchema();

            // remove join
            const reducedSchema = transformSchema(schema, {
                transformFields(config: GraphQLFieldConfigMap<any, any>) {
                    return filterValues(config, (value, key) => key != 'keyField');
                }
            });
            const linkConfigType = reducedSchema.getTypeMap()[EXTENDED_INTROSPECTION_TYPE_NAMES.fieldLink] as GraphQLObjectType;
            expect(Object.keys(linkConfigType.getFields())).toEqual(['field', 'batchMode', 'argument', 'linkFieldName']);

            const metadata = await fetchSchemaMetadata(new LocalEndpoint(reducedSchema), reducedSchema);
            expect(metadata.fieldMetadata.has('Query.field')).toBeTruthy('Query.field missing');
            expect(metadata.fieldMetadata.get('Query.field')!.link!.field).toEqual(fieldMetadata.link!.field);
            expect(metadata.fieldMetadata.get('Query.field')!.link!.keyField).toBeUndefined('keyField should be undefined');
        });
    });
});
