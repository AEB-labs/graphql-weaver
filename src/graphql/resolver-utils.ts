import {ResponsePath} from "graphql";

/**
 * Walks a response path as given in GraphQLResolveInfo.path and collects the aliases from root to leaf
 *
 * List types are not supported
 * @param path
 * @returns {string[]}
 */
export function collectAliasesInResponsePath(path: ResponsePath) {
    const aliases: string[] = [];
    let entry: ResponsePath | undefined = path;
    while (entry) {
        if (typeof entry.key == 'number') {
            throw new Error(`List types around proxy fields not supported`);
        }
        aliases.unshift(entry.key);
        entry = entry.prev;
    }
    return aliases;
}
