import { ASTNode, BREAK, DocumentNode, GraphQLErrorLocation, Source, visit } from 'graphql';
import LineColumnFinder = require('line-column');

export function findNodeAtLocation(location: GraphQLErrorLocation, document: DocumentNode) {
    let pos: number|undefined;
    let source: Source|undefined;
    let nodeAtLocation: ASTNode|undefined = undefined;
    visit(document, {
        enter(node: ASTNode) {
            if (!node.loc) {
                return;
            }
            if (pos == undefined) {
                source = node.loc.source;
                pos = getPositionFromLocation(location, source);
                if (pos < 0) {
                    return BREAK; // not found
                }
            } else if (node.loc.source != source) {
                // found multiple sources - this is not supported
                return BREAK;
            }
            if (node.loc && node.loc.start >= pos) {
                // only return the node if not already past
                if (pos <= node.loc.end) {
                    nodeAtLocation = node;
                }
                return BREAK;
            }
        }
    });
    return nodeAtLocation;
}

function getPositionFromLocation(location: GraphQLErrorLocation, source: Source) {
    return new LineColumnFinder(source.body).toIndex({
        line: location.line,
        col: location.column
    });
}
