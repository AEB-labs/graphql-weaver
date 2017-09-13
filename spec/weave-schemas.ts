import { weaveSchemas } from '../src/weave-schemas';
import { GraphQLClient } from '../src/graphql-client/graphql-client';
import {
    DocumentNode, execute, FieldNode, graphql, GraphQLObjectType, GraphQLSchema, GraphQLString, visit
} from 'graphql';
import { PipelineModule, PostMergeModuleContext, PreMergeModuleContext } from '../src/pipeline/pipeline-module';
import { transformSchema } from '../src/graphql/schema-transformer';
import { Query } from '../src/graphql/common';
import { assertSuccessfulResult } from '../src/graphql/execution-result';

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
