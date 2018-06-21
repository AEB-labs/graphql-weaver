import { GraphQLError, ResponsePath } from 'graphql';

export function prefixGraphQLErrorPath(error: GraphQLError, pathPrefix: ResponsePath, removePrefixLength: number) {
    if (!(error instanceof GraphQLError) || !error.path) {
        return error;
    }
    const newPath = [
        ...responsePathToArray(pathPrefix),
        ...error.path.slice(removePrefixLength)
    ];
    return new GraphQLError(error.message, error.nodes, error.source, error.positions, newPath, error);
}

function responsePathToArray(path: ResponsePath|undefined): (string|number)[] {
    if (!path) {
        return [];
    }
    return [
        ...responsePathToArray(path.prev),
        path.key
    ];
}
