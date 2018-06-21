import { DocumentNode, GraphQLError, SourceLocation, Location, parse, print } from 'graphql';
import { ClientExecutionResult } from './client-execution-result';
import { findNodeAtLocation } from '../graphql/node-at-location';
import { findNodeInOtherDocument } from '../graphql/ast-synchronization';
import { compact } from '../utils/utils';

/**
 * Map error locations in an execution result back to the document's loc info, assuming the execution was done on a
 * simple print() call of the document
 *
 * This is required because print does not respect the original locations in the AST.
 */
export function mapErrorLocations(response: ClientExecutionResult, document: DocumentNode): ClientExecutionResult {
    if (!response || !response.errors || !response.errors.length || !response.errors.some(er => !!er.locations && er.locations.length > 0)) {
        return response;
    }

    const printedAST = parse(print(document)); // format it the same way like getBody() did
    return {
        ...response,
        errors: response.errors.map(error => {
            if (!error.locations || !error.locations.length) {
                return error;
            }
            const positions = compact<Location>(error.locations.map(location => mapLocationsToOriginal(location, printedAST, document)));
            const source = positions.length ? positions[0].source : undefined;
            return new GraphQLError(error.message, undefined, source, positions.map(p => p.start), error.path, undefined, error.extensions);
        })
    }
}

function mapLocationsToOriginal(location: SourceLocation, sourceDocument: DocumentNode, targetDocument: DocumentNode): Location|undefined {
    const nodeInPrinted = findNodeAtLocation(location, sourceDocument);
    if (!nodeInPrinted) {
        return undefined;
    }
    // find node
    const nodeInOriginalDoc = findNodeInOtherDocument(nodeInPrinted, sourceDocument, targetDocument);
    if (!nodeInOriginalDoc || !nodeInOriginalDoc.loc) {
        return undefined;
    }
    return nodeInOriginalDoc.loc;
}
