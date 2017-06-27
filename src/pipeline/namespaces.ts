import { PipelineModule } from './pipeline-module';
import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { maybeDo } from '../utils';

/**
 * Wraps the root types into a field of a new type
 *
 * This is in preparation of schema merges
 */
export class NamespaceModule implements PipelineModule {
    constructor(private readonly namespace: string) {

    }

    transformSchema(schema: GraphQLSchema) {
        return new GraphQLSchema({
            directives: schema.getDirectives(),
            query: this.wrap(schema.getQueryType(), 'Query'),
            mutation: maybeDo(schema.getMutationType(), type => this.wrap(type, 'Mutation')),
            subscription: maybeDo(schema.getSubscriptionType(), type => this.wrap(type, 'Subscription')),
        })
    }

    // not sure yet if we need this - we didn't in the pre-pipeline design
    /*transformNode(node: ASTNode) {
    }**/

    private wrap(type: GraphQLObjectType, operation: string): GraphQLObjectType {
        return new GraphQLObjectType({
            name: `Wrapped${type.name}`, // TODO collisions
            description: 'Namespace root', // does not really matter, will be discarded on merge anyway
            fields: {
                [this.namespace]: {
                    type: type!,
                    description: `${operation} of ${this.namespace}`
                }
            }
        });
    }
}
