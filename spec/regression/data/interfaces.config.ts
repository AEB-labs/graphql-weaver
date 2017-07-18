import { GraphQLInterfaceType, GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';

export async function getConfig() {
    class Class1 {
        constructor(public readonly a: string) {}
        get a1() { return this.a + "_1" }
    }
    class Class2 {
        constructor(public readonly a: string) {}
        get a2() { return this.a + "_2" }
    }

    let objType1: GraphQLObjectType;
    let objType2: GraphQLObjectType;

    const interfaceType = new GraphQLInterfaceType({
        name: 'InterfaceType',
        fields: {
            a: {
                type: GraphQLString
            }
        },
        resolveType(value) {
            if (value instanceof Class1) {
                return objType1;
            }
            return objType2;
        }
    });

    objType1 = new GraphQLObjectType({
        name: 'Type1',
        fields: {
            a: {
                type: GraphQLString
            },
            a1: {
                type: GraphQLString
            }
        },
        interfaces: [ interfaceType ]
    });

    objType2 = new GraphQLObjectType({
        name: 'Type2',
        fields: {
            a: {
                type: GraphQLString
            },
            a2: {
                type: GraphQLString
            }
        },
        interfaces: [ interfaceType ]
    });

    return {
        endpoints: [
            {
                schema: new GraphQLSchema({
                    query: new GraphQLObjectType({
                        name: 'Query',
                        fields: {
                            field1: {
                                type: new GraphQLNonNull(interfaceType),
                                resolve: () => new Class1("value1")
                            },
                            field2: {
                                type: new GraphQLNonNull(interfaceType),
                                resolve: () => new Class2("value2")
                            }
                        }
                    }),
                    types: [ objType1, objType2, interfaceType ]
                })
            },
        ]
    };
}
