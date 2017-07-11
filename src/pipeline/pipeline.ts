import {
    EndpointInfo, PipelineModule, PostMergeModuleContext, PostMergeModuleFactory, PreMergeModuleContext,
    PreMergeModuleFactory,
    runQueryPipeline, runSchemaPipeline
} from './pipeline-module';
import { TypePrefixesModule } from './type-prefixes';
import { NamespaceModule } from './namespaces';
import { DefaultResolversModule } from './default-resolvers';
import { AbstractTypesModule } from './abstract-types';
import { LinksModule } from './links';
import { DocumentNode } from 'graphql';
import { ProxyResolversModule } from './proxy-resolvers';
import { EndpointFactory } from '../endpoints/endpoint-factory';
import { ExtendedSchema } from '../extended-schema/extended-schema';
import { mergeExtendedSchemas } from '../extended-schema/merge-extended-schemas';
import { ExtendedIntrospectionModule } from './extended-introspection';
import { AdditionalMetadataModule } from './additional-metadata';
import {EndpointConfig} from "../config/proxy-configuration";
import { JoinModule } from './join';

function preMergeModulesFactory(context: PreMergeModuleContext): PipelineModule[] {
    const preMergePipeline: PipelineModule[] = [
        // those three make the schema fully-functional
        new ProxyResolversModule(context),
        new DefaultResolversModule(),
        new AbstractTypesModule(),

        new AdditionalMetadataModule(context.endpointConfig)
    ];

    if (context.endpointConfig.typePrefix) {
        preMergePipeline.push(new TypePrefixesModule(context.endpointConfig.typePrefix))
    }
    if (context.endpointConfig.namespace) {
        preMergePipeline.push(new NamespaceModule(context.endpointConfig.namespace))
    }

    return preMergePipeline;
}

function postMergeModulesFactory(context: PostMergeModuleContext): PipelineModule[] {
    return [
        new LinksModule(),
        new JoinModule(),
        new ExtendedIntrospectionModule()
    ]
}

type Query = { document: DocumentNode, variableValues: { [name: string]: any } }

export function runPipeline(endpoints: EndpointInfo[], endpointFactory: EndpointFactory): ExtendedSchema {
    const pipeline = new Pipeline(endpoints, endpointFactory);
    return pipeline.schema;
}

class Pipeline {
    private readonly preMergeModules: Map<string, PipelineModule[]>;
    private readonly postMergeModules: PipelineModule[];
    private _schema: ExtendedSchema | undefined;

    constructor(private readonly endpoints: EndpointInfo[], private readonly endpointFactory: EndpointFactory) {
        const extendedEndpoints = endpoints.map(endpoint => ({
            ...endpoint,
            processQuery: this.processQuery.bind(this)
        }));

        this.preMergeModules = new Map(extendedEndpoints.map(context =>
            <[string, PipelineModule[]]>[
                context.endpointConfig.identifier, // map key
                preMergeModulesFactory(context) // map value
            ]));
        this.postMergeModules = postMergeModulesFactory({
            endpoints: extendedEndpoints,
            processQuery: this.processQuery.bind(this),
            endpointFactory
        });
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
        query = runQueryPipeline([...this.postMergeModules], query);
        if (!this.preMergeModules.has(endpointIdentifier)) {
            throw new Error(`Endpoint ${endpointIdentifier} does not exist`);
        }
        const preMergeModules = this.preMergeModules.get(endpointIdentifier)!;
        return runQueryPipeline([...preMergeModules, ...this.postMergeModules].reverse(), query);
    }
}
