import { ASTNode, BREAK, GraphQLSchema, TypeInfo, visit } from 'graphql';

/**
 * Gets a TypeInfo instance that is initialized at a specific node within a schema
 *
 * @param root a node in the context of the given schema
 * @param targetNode the node where the TypeInfo instance should be initilazed at
 * @param schema
 * @returns {any}
 */
export function initTypeInfoForNode(root: ASTNode, targetNode: ASTNode, schema: GraphQLSchema) {
    const typeInfo = new TypeInfo(schema);
    let found = false;
    // Can't use visitWithTypeInfo here because it calls all leave() functions even on BREAK
    visit(root, {
        enter(node: ASTNode) {
            if (node == targetNode) {
                found = true;
                return BREAK;
            }
            typeInfo.enter(node);
        },
        leave(node: ASTNode) {
            if (!found) {
                typeInfo.leave(node);
            }
        }
    });
    if (!found) {
        throw new Error(`${targetNode.kind} node not found in document`);
    }
    return typeInfo;
}
