import {
    EndpointInfo, PipelineConfig, PipelineModule, PostMergeModuleContext, PreMergeModuleContext, runQueryPipeline,
    runSchemaPipeline
} from './pipeline-module';
import { TypePrefixesModule } from './type-prefixes';
import { NamespaceModule } from './namespaces';
import { DefaultResolversModule } from './default-resolvers';
import { AbstractTypesModule } from './abstract-types';
import { LinksModule } from './links';
import { DocumentNode } from 'graphql';
import { ProxyResolversModule } from './proxy-resolvers';
import { ExtendedSchema } from '../extended-schema/extended-schema';
import { mergeExtendedSchemas } from '../extended-schema/merge-extended-schemas';
import { ExtendedIntrospectionModule } from './extended-introspection';
import { AdditionalMetadataModule } from './additional-metadata';
import { CustomScalarTypesSerializationModule } from './custom-scalar-types-serialization';
import { ErrorResolversModule } from './error-resolvers';

function createPreMergeModules(context: PreMergeModuleContext, customConfig?: PipelineConfig): PipelineModule[] {
    let customizableModules: PipelineModule[] = [];

    if (context.endpointConfig.typePrefix) {
        customizableModules.push(new TypePrefixesModule(context.endpointConfig.typePrefix));
    }
    if (context.endpointConfig.namespace) {
        customizableModules.push(new NamespaceModule(context.endpointConfig.namespace));
    }

    if (customConfig && customConfig.transformPreMergePipeline) {
        customizableModules = customConfig.transformPreMergePipeline(customizableModules, context);
    }

    return [
        // those three make the schema fully-functional
        new ProxyResolversModule(context),
        new DefaultResolversModule(),
        new ErrorResolversModule(),
        new CustomScalarTypesSerializationModule(),
        new AbstractTypesModule(),

        // there should be no reason to change this one either
        new AdditionalMetadataModule(context.endpointConfig),

        ...customizableModules
    ];
}

function createPostMergeModules(context: PostMergeModuleContext, customConfig?: PipelineConfig): PipelineModule[] {
    let customizableModules: PipelineModule[] = [
        new LinksModule()
    ];

    if (customConfig && customConfig.transformPostMergePipeline) {
        customizableModules = customConfig.transformPostMergePipeline(customizableModules, context);
    }

    return [
        ...customizableModules,

        // this needs to be at the end
        new ExtendedIntrospectionModule()
    ];
}

type Query = { document: DocumentNode, variableValues: { [name: string]: any } }

export function runPipeline(endpoints: EndpointInfo[], customConfig?: PipelineConfig): ExtendedSchema {
    const pipeline = new Pipeline(endpoints, customConfig);
    return pipeline.schema;
}

class Pipeline {
    private readonly preMergeModules: Map<string, PipelineModule[]>;
    private readonly postMergeModules: PipelineModule[];
    private _schema: ExtendedSchema | undefined;

    constructor(private readonly endpoints: EndpointInfo[], customConfig?: PipelineConfig) {
        const extendedEndpoints = endpoints.map(endpoint => ({
            ...endpoint,
            processQuery: (query: Query) => this.processQuery(query, endpoint.endpointConfig.identifier!)
        }));

        this.preMergeModules = new Map(extendedEndpoints.map(context =>
            <[string, PipelineModule[]]>[
                context.endpointConfig.identifier, // map key
                createPreMergeModules(context, customConfig) // map value
            ]));
        this.postMergeModules = createPostMergeModules({
            endpoints: extendedEndpoints
        }, customConfig);
    }

    get schema() {
        if (!this._schema) {
            this._schema = this.createSchema();
        }
        return this._schema;
    }

    private createSchema() {
        const schemas = this.endpoints.map(endpoint => {
            const schema = endpoint.schema;
            return runSchemaPipeline(this.preMergeModules.get(endpoint.endpointConfig.identifier!)!, schema);
        });

        const schema = mergeExtendedSchemas(...schemas);

        return runSchemaPipeline(this.postMergeModules, schema);
    }

    processQuery(query: Query, endpointIdentifier: string): Query {
        if (!this.preMergeModules.has(endpointIdentifier)) {
            throw new Error(`Endpoint ${endpointIdentifier} does not exist`);
        }
        const preMergeModules = this.preMergeModules.get(endpointIdentifier)!;
        return runQueryPipeline([...preMergeModules, ...this.postMergeModules].reverse(), query);
    }
}
