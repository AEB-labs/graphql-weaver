import { weaveSchemas, weaveSchemasExt } from '../src/weave-schemas';
import { GraphQLClient } from '../src/graphql-client/graphql-client';
import {
    DocumentNode, execute, ExecutionResult, FieldNode, graphql, GraphQLObjectType, GraphQLSchema, GraphQLString, visit,
    print
} from 'graphql';
import { PipelineModule, PostMergeModuleContext, PreMergeModuleContext } from '../src/pipeline/pipeline-module';
import { transformSchema } from 'graphql-transformer';
import { Query } from '../src/graphql/common';
import { assertSuccessfulResult } from '../src/graphql/execution-result';
import { WeavingErrorHandlingMode } from '../src/config/error-handling';
import { WeavingError } from '../src/config/errors';
import { WeavingConfig } from '../src/config/weaving-config';

describe('weaveSchemas', () => {
    const testSchema = new GraphQLSchema({
        query: new GraphQLObjectType({
            name: 'Query',
            fields: {
                test: {
                    type: GraphQLString, resolve() {
                        return 'the value';
                    }
                }
            }
        })
    });

    it('supports custom endpoints and passes through context', async () => {
        let wasExecuted = false;
        let capturedContext: any = undefined;

        const client: GraphQLClient = {
            async execute(document: DocumentNode, variables: { [name: string]: any }, context: any) {
                wasExecuted = true;
                capturedContext = context;
                return execute(testSchema, document, undefined, context, variables);
            }
        };

        const wovenSchema = await weaveSchemas({
            endpoints: [
                {
                    client
                }
            ]
        });

        const context = {the: 'context'};
        const result = await graphql(wovenSchema, '{test}', undefined, context);
        expect(wasExecuted).toBeTruthy('Endpoint was not called');
        expect(capturedContext).toBe(context, 'Context was not passed to endpoint');
    });

    it('allows to customize pre-merge pipeline', async () => {
        const module = new ScreamModule();
        const wovenSchema = await weaveSchemas({
            endpoints: [
                {
                    schema: testSchema
                }
            ],
            pipelineConfig: {
                transformPreMergePipeline(modules: PipelineModule[], context: PreMergeModuleContext) {
                    return [...modules, module];
                }
            }
        });

        expect(module.schemaPipelineExecuted).toBeTruthy('Schema pipeline was not executed');

        const result = await graphql(wovenSchema, '{TEST}');
        const data = assertSuccessfulResult(result);

        expect(module.queryPipelineExecuted).toBeTruthy('Query pipeline was not executed');
        expect(data['TEST']).toBe('the value');
    });

    it('allows to customize post-merge pipeline', async () => {
        const module = new ScreamModule();
        const wovenSchema = await weaveSchemas({
            endpoints: [
                {
                    schema: testSchema
                }
            ],
            pipelineConfig: {
                transformPostMergePipeline(modules: PipelineModule[], context: PostMergeModuleContext) {
                    return [...modules, module];
                }
            }
        });

        expect(module.schemaPipelineExecuted).toBeTruthy('Schema pipeline was not executed');

        const result = await graphql(wovenSchema, '{TEST}');
        const data = assertSuccessfulResult(result);

        expect(module.queryPipelineExecuted).toBeTruthy('Query pipeline was not executed');
        expect(data['TEST']).toBe('the value');
    });

    it('throws when endpoint schemas can not be retrieved', async () => {
        const errorClient: GraphQLClient = {
            execute(query, vars, context, introspection): Promise<ExecutionResult> {
                throw new Error(introspection ? 'Throwing introspection' : 'Throwing query');
            }
        };

        async function test(config: WeavingConfig) {
            let error: Error | undefined = undefined;
            // can't use expect().toThrow because of promises
            await weaveSchemas(config).catch(e => error = e);
            expect(error).toBeDefined('failed with ' + config.errorHandling);
            expect(error!.constructor.name).toBe(WeavingError.name);
            expect(error!.message).toMatch(/.*Throwing introspection.*/);
        }

        await test({
            endpoints: [
                {
                    client: errorClient
                }
            ]
        });

        await test({
            endpoints: [
                {
                    client: errorClient
                }
            ],
            errorHandling: WeavingErrorHandlingMode.THROW
        });

        // the other modes are tested via regression tests
    });

    it('passes through client errors in originalError', async () => {
        class CustomError extends Error {
            constructor() {
                super('custom message');
                Object.setPrototypeOf(this, CustomError.prototype);
            }

            get specialValue() {
                return true;
            }
        }

        const errorClient: GraphQLClient = {
            execute(query, vars, context, introspection): Promise<ExecutionResult> {
                if (introspection) {
                    return graphql(testSchema, print(query), {}, {}, vars);
                } else {
                    throw new CustomError();
                }
            }
        };

        const schema = await weaveSchemas({
            endpoints: [{
                client: errorClient
            }]
        });

        const result = await graphql(schema, '{test}');

        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeDefined();
        expect(result.errors![0].message).toEqual('custom message');
        const originalError: any = result.errors![0].originalError;
        expect(originalError.constructor.name).toBe(CustomError.name);
        expect(originalError instanceof CustomError).toBeTruthy();
        expect(originalError.specialValue).toEqual(true);
    });
});

describe('weaveSchemasExt', () => {
    it('reports recoverable errors', async () => {
        const errorClient: GraphQLClient = {
            execute(query, vars, context, introspection): Promise<ExecutionResult> {
                throw new Error(introspection ? 'Throwing introspection' : 'Throwing query');
            }
        };

        const result = await weaveSchemasExt({
            endpoints: [
                {
                    client: errorClient
                }
            ],
            errorHandling: WeavingErrorHandlingMode.CONTINUE
        });

        expect(result.schema).toBeDefined();
        expect(result.hasErrors).toBe(true);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].message).toContain('Throwing introspection');
    });

    it('reports successful results correctly', async () => {
        const result = await weaveSchemasExt({
            endpoints: [ ]
        });

        expect(result.schema).toBeDefined();
        expect(result.hasErrors).toBe(false);
        expect(result.errors).toEqual([]);
    });
});

// only works in schemas with only lowercase names
class ScreamModule implements PipelineModule {
    schemaPipelineExecuted = false;
    queryPipelineExecuted = false;

    transformSchema(schema: GraphQLSchema) {
        this.schemaPipelineExecuted = true;
        return transformSchema(schema, {
            transformField(field) {
                return {
                    ...field,
                    name: field.name.toUpperCase()
                };
            }
        });
    }

    transformQuery(query: Query) {
        this.queryPipelineExecuted = true;
        return {
            ...query,
            document: visit(query.document, {
                Field(node: FieldNode) {
                    return {
                        ...node,
                        name: {
                            kind: 'Name',
                            value: node.name.value.toLowerCase()
                        },
                        alias: {
                            kind: 'Name',
                            value: node.alias ? node.alias.value : node.name.value
                        }
                    };
                }
            })
        };
    }
}
