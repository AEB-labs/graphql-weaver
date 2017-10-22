import gql from 'graphql-tag';
import { DocumentNode, FieldNode, ObjectValueNode, OperationDefinitionNode, parse, Source } from 'graphql';
import { findNodeAtLocation } from '../../src/graphql/node-at-location';

describe('findNodeAtLocation', () => {
    it('finds node', () => {
        // would love to use gql tag, but it somehow manages parse without setting locations
        const ast: DocumentNode = parse(`
            {
                someField(arg: { value: "String" }) {
                    scalar
                }
            }`);
        const node = (((ast.definitions[0] as OperationDefinitionNode).selectionSet.selections[0] as FieldNode)
            .arguments![0].value as ObjectValueNode).fields[0].value;
        const location = node.loc!.startToken;
        const foundNode = findNodeAtLocation(location, ast);
        expect(foundNode).toBeDefined();
        expect((foundNode as any).kind).toBe('StringValue');
    });
});
