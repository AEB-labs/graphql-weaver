# graphql-proxy

A configurable GraphQL server that combines multiple GraphQL APIs in one schema

## Getting started

After cloning the repository, run

```bash
npm install
npm start
```

To run the test suite, run

```bash
npm test
```

To debug/run the application (or tests) in WebStorm, right-click on `graphql-proxy.js` (or `graphql-proxy-tests.js`, respectively) and choose *Debug*/*Run*.

## Architecture

graphql-proxy takes a set of GraphQL endpoints, transforms them through pipelines, merges them, transforms the merged schema again and exposes that as its *proxy schema*.

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
* `pipeline` - the core, being framework and modules for graphql-proxy's features
* `config` - configuration of the server
* `utils` - utilities unrelated to GraphQL
* `typings` - typings for thirdparty modules
