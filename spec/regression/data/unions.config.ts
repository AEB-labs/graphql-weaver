import { GraphQLInt, GraphQLObjectType, GraphQLSchema, GraphQLUnionType } from 'graphql';
import {testTypes} from "../../helpers/test-types";
import { WeavingConfig } from '../../../src/config/weaving-config';

export async function getConfig(): Promise<WeavingConfig> {
    const option1 = new GraphQLObjectType({
        name: 'Option1',
        fields: {option1: {type: GraphQLInt}},
        isTypeOf: (obj) => { return 'option1' in obj; }
    });
    const option2 = new GraphQLObjectType({
        name: 'Option2',
        fields: {option2: {type: GraphQLInt}},
        isTypeOf: (obj) => { return 'option2' in obj; }
    });

    const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
            name: 'Query',
            fields: {
                union: {
                    type: new GraphQLUnionType({
                        name: 'Union',
                        types: [ option1, option2 ]
                    }),
                    resolve: () => { return { option2: 123 } }
                }
            }
        })
    });

    return {
        endpoints: [
            {
                schema,
                namespace: 'unions',
                typePrefix: 'U'
            }
        ]
    };
}
