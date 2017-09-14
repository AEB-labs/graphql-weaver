# graphql-weaver

[![npm version](https://badge.fury.io/js/graphql-weaver.svg)](https://npmjs.org/graphql-weaver) [![Build Status](https://travis-ci.org/AEB-labs/graphql-weaver.svg?branch=master)](https://travis-ci.org/AEB-labs/graphql-weaver)

A tool to combine, link and transform GraphQL schemas

Use graphql-weaver if you have multiple GraphQL servers and want to combine them into one API. Features like namespacing, links and custom transformation modules allow you to augment the API as you like.

## How to use

```bash
npm install --save graphql-weaver
```

Basic usage:

```typescript
const schema: GraphQLSchema = await weaveSchemas({
    endpoints: [{
        namespace: 'model',
        typePrefix: 'Model',
        url: 'http://localhost:8080/graphql' // url to a GraphQL endpoint
    }, {
        namespace: 'local',
        schema: new GraphQLSchema(/* ... */) // use schema instance directly
    }]
})
```

A *woven schema* is an executable GraphQL schema built from several *endpoints*. For each endpoint, you can either specify a URL to a GraphQL server, pass an executable GraphQL schema instance, or implement the [`GraphQLClient`](src/graphql-client/graphql-client.ts) interface yourself.

In its basic configuration, `weaveSchemas` merges the query, mutation and subscription fields of all endpoints. To avoid name collisions, you can specify the `namespace` and `typePrefix` properties like seen above. The `typePrefix` will be prepended to all types; `namespace` causes the fields of this endpoint to be wrapped in a field, to be queried via `{ model { aFieldOfModel } }`.

### Links

In the spirit of GraphQL, this tool allows you to create links between objects of different endpoints. Suppose you have a music recommendation service and a music library service. You can make the whole properties of a song available in the recommendation API without the recommendation service knowing all song properties.

```typescript
const schema: GraphQLSchema = await weaveSchemas({
    endpoints: [{
        namespace: 'library',
        url: 'http://example.com/library/graphql'
    }, {
        namespace: 'recommendations',
        url: 'http://example.com/recommendations/graphql',
        fieldMetadata: {
            'Recommendation.song': { // Field song in type Recommendation
                link: {
                    field: 'library.Song', // field Song in namespace library
                    argument: 'id', // argument of library.Song
                    batchMode: false,
                }
            }
        }
     }]
});
```
This assumes the library schema has a field `Song` which accepts a `id` argument, and the recommendations schema has a type `Recommendation` with a field `song` which contains the song id. Then, you can query the recommendations with all song information like this:

```graphql
query {
    recommendations {
        myRecommendations {
            recommendedAt
            song {
                id
                artist
                title
                year
            }
        }
    }
}
```

If there are many recommendations, this is ineficcient because all songs are queried independently.  If the library schema supports querying multiple songs at once, you can set `batchMode` to `true`. If the library schema may return the songs in a different order than the ids its get, you need to set `keyField` too.

```typescript
const schema: GraphQLSchema = await weaveSchemas({
    endpoints: [{
        namespace: 'library',
        url: 'http://example.com/library/graphql'
    }, {
        namespace: 'recommendations',
        url: 'http://example.com/recommendations/graphql',
        fieldMetadata: {
            'Recommendation.song': {
                link: {
                    field: 'library.allSongs',
                    argument: 'filter.ids', // allSongs has an argument filter with an array field ids
                    batchMode: true,
                    keyField: 'id' // the name of a field in Song type that contains the id
                }
            }
        }
     }]
});
```

### Joins

What if you want to sort the recommendations by the song age, or filter by artist? The recommendation service currently does not know about these fields, so it does not offer an API to sort or order by any of them. Using graphql-weaver, this problem is easily solved:

```typescript
const schema: GraphQLSchema = await weaveSchemas({
    endpoints: [{
        namespace: 'library',
        url: 'http://example.com/library/graphql'
    }, {
        namespace: 'recommendations',
        url: 'http://example.com/recommendations/graphql',
        fieldMetadata: {
            'Recommendation.song': {
                link: {
                    field: 'library.allSongs',
                    argument: 'filter.ids',
                    batchMode: true, // is now required
                    keyField: 'id' // this one too
                }
            },
            'Query.myRecommendations': { // Field myRecommendations on type Query
                join: {
                    linkField: 'song', // The field name song in the type Recommendation
                }
            }
        }
     }]
});
```

This assumes that the library service offers a way to filter and sort songs via the `orderBy` and `filter` arguments. Using it is simple:

```graphql
query {
    recommendations {
        myRecommendations(filter: { song: { artist: "Ed Sheeran" } }, orderBy: song_year_DESC) {
            recommendedAt
            song {
                id
                artist
                title
                year
            }
        }
    }
}
```

A note on efficiency: The list of recommendations should be relatively small (not more than a few hundred), as all recommendations need to be fetched so that their ids can be sent to the library for filtering and sorting.

### Custom Transformations

All four presented features (namespaces, type prefixes, links and joins) are implemented as independent modules. If you need something else, you can just write your own module:

```typescript
class MyModule implements PipelineModule {
    transformExtendedSchema(schema: ExtendedSchema): ExtendedSchema {
        // do something with the schema
        return schema;
    }
    transformQuery(query: Query): Query {
        // do something with the query
        return query;
    }
}

const schema: GraphQLSchema = weaveSchemas({
    endpoints: [{
        namespace: 'library',
        url: 'http://example.com/library/graphql',
        
    }],
    pipelineConfig: {
        transformPreMergePipeline(modules: PipelineModule[], context: PreMergeModuleContext): PipelineModule[] {
            // These modules are executed for each endpoint
            return [
                ...modules,
                new MyModule()
            ]
        },
        transformPostMergePipeline(modules: PipelineModule[], context: PostMergeModuleContext): PipelineModule[] {
            // These modules are executed once for the merged schema
            return [
                ...modules,
                new MyModule()
            ]
        }
    }
});
```

For a simple module, see [`TypePrefixModule`](src/pipeline/type-prefixes.ts). The section *Architecture* below gives an overview over the pipeline architecture.

To simplify modifications to a schema, graphql-weaver ships [`transformSchema`](src/graphql/schema-transformer.ts) (and [`transformExtendedSchema`](src/extended-schema/extended-schema-transformer.ts)). You can change types and fields as you like with a simple function:

```typescript
const transformedSchema = transformSchema(originalSchema, {
    transformField(field: GraphQLNamedFieldConfig<any, any>, context) {
        // Rename a field in a type
        if (context.oldOuterType.name == 'MyType') {
            return {
                ...field,
                name: field.name + 'ButCooler'
            }
        }
        return field;
    },

    transformObjectType(type: GraphQLObjectTypeConfig<any, any>) {
        if (type.name == 'MyType') {
            return {
                ...type,
                name: 'MyCoolType'
            };
        }
        return type;
    },

    transformFields(fields: GraphQLFieldConfigMap<any, any>, context) {
        // You can even copy types on the fly and transform the copies
        const type2 = context.copyType(context.oldOuterType, {
            transformObjectType(typeConfig: GraphQLObjectTypeConfig<any, any>) {
                return {
                    ...typeConfig,
                    name: typeConfig.name + '2',
                    resolve: (source: any) => source
                };
            }
        });

        // This just adds a reflexive field "self" to all types, but its type does not have
        // the "self" field (because it is a copy from the original type, see above)
        // it also won't have the "cool" rename applied because the top-level transformers are not applied
        return {
            ...fields,
            self: {
                type: type2
            }
        }
    }
});
```

[This test case](spec/graphql/schema-transformer.spec.ts) demonstrates that and how it works.

## Contributing

After cloning the repository, run

```bash
npm install
npm start
```

To run the test suite, run

```bash
npm test
```

To debug/run the application (or tests) in WebStorm, right-click on `graphql-weaver.js` (or `graphql-weaver-tests.js`, respectively) and choose *Debug*/*Run*.

### Release workflow

* For **normal development**, create a branch from master, commit and create a merge request to master. 
* To **fix a bug in a previous release**, find the *release-* branch for the corresponding version, increase the *patch* level in `package.json` and push the changes. Once the tests pass, manually trigger the *deploy* stage in Gitlab. You can also release a *-rc.1* version before the actual release for prior testing in dependent modules.
* To prepare a **new feature release** (currently, this means a new minor version), create a `release-0.x` branch from master. Set the version to `0.x-rc.1`, push and manually trigger the *deploy* stage in Gitlab. Test the changes in dependent modules. Once everything is ok, change the version to `0.x` and deploy again. Finally, merge the release branch into *master*. Do not delete the release branch as it is used for hotfixes.

## Architecture

graphql-weaver takes a set of GraphQL endpoints, transforms them through pipelines, merges them, transforms the merged schema again and exposes that as its *woven schema*.

```
           +------+  +------+  +------+
Endpoints  |Schema|  |Schema|  |Schema|
           +------+  +------+  +------+

           +------+  +------+  +------+
            X    X    X    X    X    X
Pipelines    X  X      X  X      X  X
              XX        XX        XX

               +                  +
Merge           +----------------+

                     +------+
                      X    X
Pipeline               X  X
                        XX

                     +------+
Server               |Schema|
                     +------+

```

The *merge* in the middle simply merges all the fields of the Query/Mutation types. All the other features, like type prefixing, field namespacing, even resolvers, is implemented by pipeline modules.

You'll find the list of modules in `src/pipeline/pipeline.ts`. For a description of each module, please refer to the TypeDoc comments.

## Module structure

* `graphql` - general utilities for working with GraphQL schemas and queries
* `extended-schema` - an implementation of storing and exposing metadata on fields, the concept being [discussed on GitHub](https://github.com/facebook/graphql/issues/300)
* `graphql-client` - GraphQL client library, with local and http implementations
* `pipeline` - the core, being framework and modules for graphql-weaver's features
* `config` - configuration parameter types for `weaveSchemas`
* `utils` - utilities unrelated to GraphQL
* `typings` - typings for thirdparty modules
