import { ASTNode, BREAK, DocumentNode, visit } from 'graphql';

/**
 * Given two equal documents, finds a node of one schema in the other schema
 * @param {ASTNode} needle
 * @param {DocumentNode} needleDocument the document which needle node
 * @param {DocumentNode} targetDocument the document of which to return the node matching needle
 */
export function findNodeInOtherDocument(needle: ASTNode, needleDocument: DocumentNode, targetDocument: DocumentNode): ASTNode|undefined {
    let numberOfVisitsInDoc1 = 0;
    let foundNeedle = false;
    visit(needleDocument, {
        enter(node: ASTNode) {
            if (node == needle) {
                foundNeedle = true;
                return BREAK;
            }
            numberOfVisitsInDoc1++;
        }
    });
    if (!foundNeedle) {
        return undefined;
    }
    let matchingNode: ASTNode|undefined = undefined;
    let numberOfVisitsInDoc2 = 0;
    visit(targetDocument, {
        enter(node: ASTNode) {
            if (numberOfVisitsInDoc2 == numberOfVisitsInDoc1) {
                matchingNode = node;
                return BREAK;
            }
            numberOfVisitsInDoc2++;
        }
    });
    // sanity check
    // type assertion needed because of https://github.com/Microsoft/TypeScript/issues/9998
    if (matchingNode && (matchingNode as ASTNode).kind != needle.kind) {
        return undefined;
    }
    return matchingNode;
}