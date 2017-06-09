import { LinkTargetConfig } from '../config/proxy-configuration';
import { GraphQLSchema } from 'graphql';

const EXTENDED_INTROSPECTION_FIELD = '_extIntrospection';

export interface ExtendedIntrospectionQuery {
    _extIntrospection: {
        types: {
            name: string,
            fields: {
                name: string,
                link?: LinkTargetConfig
            }[]
        }[]
    }
}

export const EXTENDED_INTROSPECTION_QUERY = `{
    ${EXTENDED_INTROSPECTION_FIELD} {
        types { 
            name 
            fields { 
                name 
                link { 
                    endpoint 
                    field
                    argument
                    batchMode
                    keyField
                }
            }
        }
    }
}`;

export const EMPTY_INTROSPECTION_QUERY: ExtendedIntrospectionQuery = {_extIntrospection: {types: []}};

export function supportsExtendedIntrospection(schema: GraphQLSchema) {
    return EXTENDED_INTROSPECTION_FIELD in schema.getQueryType().getFields();
}
