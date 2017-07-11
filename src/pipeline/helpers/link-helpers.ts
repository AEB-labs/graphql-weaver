import { GraphQLField, GraphQLSchema } from 'graphql';
import { walkFields } from '../../graphql/schema-utils';

export function parseLinkTargetPath(path: string, schema: GraphQLSchema): { field: GraphQLField<any, any>, fieldPath: string[] } | undefined {
    const fieldPath = path.split('.');
    const field = walkFields(schema.getQueryType(), fieldPath);
    if (!field) {
        return undefined;
    }
    return {field, fieldPath};
}
