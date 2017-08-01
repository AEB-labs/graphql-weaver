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

function createPreMergeModules(context: PreMergeModuleContext, customConfig?: PipelineConfig): PipelineModule[] {
    const preMergePipeline: PipelineModule[] = [
        // those three make the schema fully-functional
        new ProxyResolversModule(context),
        new DefaultResolversModule(),
        new AbstractTypesModule(),

        new AdditionalMetadataModule(context.endpointConfig)
    ];

    if (customConfig && customConfig.createPreMergeModules) {
        preMergePipeline.push(...customConfig.createPreMergeModules(context));
    }

    if (context.endpointConfig.typePrefix) {
        preMergePipeline.push(new TypePrefixesModule(context.endpointConfig.typePrefix))
    }
    if (context.endpointConfig.namespace) {
        preMergePipeline.push(new NamespaceModule(context.endpointConfig.namespace))
    }

    return preMergePipeline;
}

function createPostMergeModules(context: PostMergeModuleContext, customConfig?: PipelineConfig): PipelineModule[] {
    const modules: PipelineModule[] = [
        new LinksModule()
    ];

    if (customConfig && customConfig.createPostMergeModules) {
        modules.push(...customConfig.createPostMergeModules(context));
    }

    modules.push(new ExtendedIntrospectionModule());
    return modules;
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
