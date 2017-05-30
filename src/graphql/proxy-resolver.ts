import {
    ASTNode, FragmentDefinitionNode, FragmentSpreadNode, GraphQLFieldResolver, GraphQLResolveInfo, print, visit
} from 'graphql';
import { query } from './client';
import { OperationTypeNode } from '@types/graphql/language';

interface ResolverConfig {
    url: string;
    operation: OperationTypeNode;
}

export function createResolver(config: ResolverConfig): GraphQLFieldResolver<any, any> {
    return async function(source: any,
                    args: { [argName: string]: any },
                    context: any,
                    info: GraphQLResolveInfo): Promise<any> {
        // Any field node in the array is fine because they
        const selections = info.fieldNodes
            .map(node => node.selectionSet ? node.selectionSet.selections : [])
            .reduce((a, b) => a.concat(b), []);
        const selectionStr = selections.map(print).join('\n');
        const fragmentsStr = collectUsedFragments(info.fieldNodes, info.fragments).map(print).join('\n');
        const queryStr = `${fragmentsStr}\n${config.operation} {\n${selectionStr}\n}`;

        return await query(config.url, queryStr);
    };
}

function pick<TValue>(object: {[key: string]: TValue}, keys: string[]): TValue[] {
    return keys.map(key => object[key]);
}

function collectUsedFragmentNames(roots: ASTNode[]): string[] {
    const fragments = new Set<string>();
    for (const root of roots) {
        visit(root, {
            FragmentSpread(node: FragmentSpreadNode) {
                fragments.add(node.name.value);
            }
        });
    }
    return Array.from(fragments);
}


function collectUsedFragments(roots: ASTNode[], fragments: {[name: string]: FragmentDefinitionNode}) {
    return pick(fragments, collectUsedFragmentNames(roots));
}
