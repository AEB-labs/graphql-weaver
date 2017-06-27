import {
    EndpointInfo, PipelineModule, PostMergeModuleFactory, PreMergeModuleFactory, runQueryPipeline, runSchemaPipeline
} from './pipeline-module';
import { TypePrefixesModule } from './type-prefixes';
import { NamespaceModule } from './namespaces';
import { DefaultResolversModule } from './default-resolvers';
import { AbstractTypesModule } from './abstract-types';
import { LinksModule } from './links';
import { DocumentNode } from 'graphql';
import { ProxyResolversModule } from './proxy-resolvers';
import { EndpointFactory } from '../endpoints/endpoint-factory';
import { ExtendedSchema } from '../endpoints/extended-introspection';
import { mergeExtendedSchemas } from '../graphql/merge-extended-schemas';
import { ExtendedIntrospectionModule } from './extended-introspection';
import { AdditionalMetadataModule } from './additional-metadata';

const preMergeModuleFactories: PreMergeModuleFactory[] = [
    ({endpointConfig}) => new AdditionalMetadataModule(endpointConfig),
    ({endpointConfig}) => new TypePrefixesModule(endpointConfig.typePrefix),
    ({endpointConfig}) => new NamespaceModule(endpointConfig.name),
    ({processQuery, endpoint, endpointConfig}) => new ProxyResolversModule({processQuery, endpoint, endpointConfig}),
    () => new DefaultResolversModule(),
    () => new AbstractTypesModule()
];

const postMergeModuleFactories: PostMergeModuleFactory[] = [
    //(context) => new LinksModule(context)
    () => new ExtendedIntrospectionModule()
];

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
                context.endpointConfig.name, // map key
                preMergeModuleFactories.map(factory => factory(context)) // map value
            ]));
        this.postMergeModules = postMergeModuleFactories.map(factory => factory({
            endpoints: extendedEndpoints,
            processQuery: this.processQuery.bind(this),
            endpointFactory
        }));
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
            return runSchemaPipeline(this.preMergeModules.get(endpoint.endpointConfig.name)!, schema);
        });

        const schema = mergeExtendedSchemas(...schemas);

        return runSchemaPipeline(this.postMergeModules, schema);
    }

    processQuery(query: Query, endpointName: string): Query {
        query = runQueryPipeline([...this.postMergeModules], query);
        if (!this.preMergeModules.has(endpointName)) {
            throw new Error(`Endpoint ${endpointName} does not exist`);
        }
        const preMergeModules = this.preMergeModules.get(endpointName)!;
        return runQueryPipeline([...preMergeModules].reverse(), query);
    }
}
