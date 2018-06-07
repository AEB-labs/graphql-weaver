import { DocumentNode, FieldNode, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { GraphQLClient } from '../graphql-client/graphql-client';
import { LinkConfig, SchemaMetadata } from './extended-schema';
import {
    buildSchemaMetadata, EXTENDED_INTROSPECTION_FIELD, EXTENDED_INTROSPECTION_TYPE_NAMES
} from './extended-introspection';
import { createFieldNode } from '../graphql/language-utils';
import { assertSuccessfulResult } from '../graphql/execution-result';
import { convertFormattedErrorsToErrors } from '../graphql-client/client-execution-result';

/**
 * Fetches SchemaMetadata over a GraphQL client
 * @param {GraphQLClient} client the client to submit queries
 * @param {GraphQLSchema} schema the client schema
 * @returns {Promise<any>} the metadata
 */
export async function fetchSchemaMetadata(client: GraphQLClient, schema: GraphQLSchema) {
    if (!supportsExtendedIntrospection(schema)) {
        return new SchemaMetadata();
    }
    const clientResult = await client.execute(getTailoredExtendedIntrospectionQuery(schema), undefined, undefined, true);
    const result = convertFormattedErrorsToErrors(clientResult);
    const resultData = assertSuccessfulResult(result);
    return buildSchemaMetadata(resultData[EXTENDED_INTROSPECTION_FIELD]);
}

export function supportsExtendedIntrospection(schema: GraphQLSchema) {
    const queryType = schema.getQueryType();
    if (!queryType) {
        return false;
    }
    return EXTENDED_INTROSPECTION_FIELD in queryType.getFields();
}

function getTailoredExtendedIntrospectionQuery(schema: GraphQLSchema): DocumentNode {
    const fieldMetadataSelections: FieldNode[] = [];

    const joinType = schema.getType(EXTENDED_INTROSPECTION_TYPE_NAMES.fieldJoin);
    if (joinType) {
        // mandatory fields
        const joinSelections: FieldNode[] = [
            createFieldNode('linkField'),
            createFieldNode('ignore')
        ];

        fieldMetadataSelections.push(createFieldNode('join', undefined, joinSelections));
    }

    const linkType = schema.getType(EXTENDED_INTROSPECTION_TYPE_NAMES.fieldLink);
    if (linkType && linkType instanceof GraphQLObjectType) {
        const propertyNames: (keyof LinkConfig)[] = ['field', 'argument', 'batchMode', 'keyField', 'linkFieldName', 'ignore'];
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
