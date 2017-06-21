import { PipelineModule } from './pipeline-module';
import { ASTNode, SelectionSetNode, visit } from 'graphql';
import { TypeResolversTransformer } from '../graphql/type-resolvers';
import { EndpointConfig } from '../config/proxy-configuration';

/**
 * Ensures that resolveType in abstract types works correctly
 */
export class AbstractTypesModule implements PipelineModule {
    getSchemaTransformer() {
        return new TypeResolversTransformer();
    }

    transformNode(node: ASTNode) {
        // The default implementation of resolveType of an interface looks at __typename.
        // Thus, it is simplest to just request that field whenever there is a fragment
        // This will cause a collision if the user requests a different field under __typename alias
        // This also means that the result always includes __typename if fragments are used, even when not requested
        return visit(node, {
            SelectionSet(node: SelectionSetNode) {
                // TODO we also need to fetch the __typename if the outer type is abstract (don't know why, but GraphQL demands it)
                // this means we need a TypeInfo. Might be worth running the TypeInfo thing once and plug in multiple visitors
                const requiresTypename = node.selections.some(sel => sel.kind == 'FragmentSpread' || sel.kind == 'InlineFragment');
                const requestsTypename = node.selections.some(sel => sel.kind == 'Field' && sel.name.value == '__typename');
                const isTypenameAilased = node.selections.some(sel => sel.kind == 'Field' && sel.name.value != '__typename' && !!sel.alias && sel.alias.value == '__typename');
                if (isTypenameAilased) {
                    throw new Error(`Fields must not be aliased to __typename because this is a reserved field.`);
                }
                if (requiresTypename && !requestsTypename) {
                    return {
                        ...node,
                        selections: [
                            ...node.selections,
                            {
                                kind: 'Field',
                                name: {
                                    kind: 'Name',
                                    value: '__typename'
                                }
                            }
                        ]
                    };
                }
                return undefined;
            }
        });
    }
}
