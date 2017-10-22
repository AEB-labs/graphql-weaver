import gql from 'graphql-tag';
import { DocumentNode, FieldNode, ObjectValueNode, OperationDefinitionNode, parse, print } from 'graphql';
import { findNodeInOtherDocument } from '../../src/graphql/ast-synchronization';

describe('findNodeInOtherDocument', () => {
    it('finds the node', () => {
        const ast: DocumentNode = gql`
            {
                # a comment to throw the lines off
                someField(arg: { value: "String" }) { scalar }
            }`;
        const node = (((ast.definitions[0] as OperationDefinitionNode).selectionSet.selections[0] as FieldNode)
            .arguments![0].value as ObjectValueNode).fields[0].value;
        const ast2 = parse(print(ast));
        const node2 = findNodeInOtherDocument(node, ast, ast2);
        expect(node2).toBeDefined();
        expect((node2 as any).kind).toBe('StringValue');
        expect(node2).not.toBe(node);
    });
});
