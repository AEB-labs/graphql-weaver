import {GraphQLObjectType, GraphQLSchema, GraphQLString} from "graphql";
import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
    return {
        endpoints: [
            {
                namespace: 'ns',
                typePrefix: "Namespace",
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            a: {
                                type: GraphQLString,
                                resolve() { return "a"; }
                            },
                            b: {
                                type: GraphQLString,
                                resolve() { return "b"; }
                            }
                        }
                    })
                })
            }
        ]
    };
}
