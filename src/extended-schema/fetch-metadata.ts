import { DocumentNode, FieldNode, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { GraphQLEndpoint } from '../endpoints/graphql-endpoint';
import { LinkConfig, SchemaMetadata } from './extended-schema';
import {
    buildSchemaMetadata, EXTENDED_INTROSPECTION_FIELD, EXTENDED_INTROSPECTION_TYPE_NAMES
} from './extended-introspection';
import { createFieldNode } from '../graphql/language-utils';

/**
 * Fetches SchemaMetadata over a GraphQL endpoint
 * @param {GraphQLEndpoint} endpoint the endpoint to submit queries
 * @param {GraphQLSchema} schema the client schema
 * @returns {Promise<any>} the metadata
 */
export async function fetchSchemaMetadata(endpoint: GraphQLEndpoint, schema: GraphQLSchema) {
    if (!supportsExtendedIntrospection(schema)) {
        return new SchemaMetadata();
    }
    const result = await endpoint.query(getTailoredExtendedIntrospectionQuery(schema));
    return buildSchemaMetadata(result[EXTENDED_INTROSPECTION_FIELD]);
}

export function supportsExtendedIntrospection(schema: GraphQLSchema) {
    return EXTENDED_INTROSPECTION_FIELD in schema.getQueryType().getFields();
}

function getTailoredExtendedIntrospectionQuery(schema: GraphQLSchema): DocumentNode {
    const fieldMetadataSelections: FieldNode[] = [];

    const joinType = schema.getType(EXTENDED_INTROSPECTION_TYPE_NAMES.fieldJoin);
    if (joinType) {
        // mandatory fields
        const joinSelections: FieldNode[] = [
            createFieldNode('linkField')
        ];

        fieldMetadataSelections.push(createFieldNode('join', undefined, joinSelections));
    }

    const linkType = schema.getType(EXTENDED_INTROSPECTION_TYPE_NAMES.fieldLink);
    if (linkType && linkType instanceof GraphQLObjectType) {
        const propertyNames: (keyof LinkConfig)[] = ['field', 'argument', 'batchMode', 'keyField', 'linkFieldName'];
        const linkSelections = propertyNames
            .filter(name => name in linkType.getFields())
            .map(name => createFieldNode(name));

        fieldMetadataSelections.push(createFieldNode('link', undefined, linkSelections));
    }

    const introspectionField = createFieldNode(EXTENDED_INTROSPECTION_FIELD, undefined, [
        createFieldNode('types', undefined, [
            createFieldNode('name'),
            createFieldNode('fields', undefined, [
                createFieldNode('name'),
                createFieldNode('metadata', undefined, fieldMetadataSelections)
            ])
        ])
    ]);

    return {
        kind: 'Document',
        definitions: [
            {
                kind: 'OperationDefinition',
                operation: 'query',
                selectionSet: {
                    kind: 'SelectionSet',
                    selections: [introspectionField]
                }
            }
        ]
    };
}
