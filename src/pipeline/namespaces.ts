import { PipelineModule } from './pipeline-module';
import {
    ASTNode, FieldNode, FragmentDefinitionNode, GraphQLObjectType, GraphQLSchema, SelectionSetNode, visit
} from 'graphql';
import { maybeDo } from '../utils';

/**
 * Wraps the root types into a field of a new type
 *
 * This is in preparation of schema merges
 */
export class NamespaceModule implements PipelineModule {
    private schema: GraphQLSchema|undefined;

    constructor(private readonly namespace: string) {

    }

    transformSchema(schema: GraphQLSchema) {
        const newSchema = new GraphQLSchema({
            directives: schema.getDirectives(),
            query: this.wrap(schema.getQueryType(), 'Query'),
            mutation: maybeDo(schema.getMutationType(), type => this.wrap(type, 'Mutation')),
            subscription: maybeDo(schema.getSubscriptionType(), type => this.wrap(type, 'Subscription'))
        });
        this.schema = newSchema;
        return newSchema;
    }

    transformNode(node: ASTNode): ASTNode {
        if (!this.schema) {
            throw new Error(`Schema not yet built`);
        }

        // unwrap namespaced queries
        return visit(node, {
            FragmentDefinition: (fragment: FragmentDefinitionNode) => {
                // only unwrap fragments on root type
                if (!isRootTypeName(fragment.typeCondition.name.value, this.schema!)) {
                    return false;
                }
                return undefined; // not changed, visit into
            },

            Field: () => false, // do not enter any field nodes

            SelectionSet: (selectionSet: SelectionSetNode): SelectionSetNode|false => {
                if (!selectionSet.selections.length) {
                    return false; // empty, skip
                }
                const node = selectionSet.selections[0];
                if (selectionSet.selections.length > 1 || node.kind != 'Field' || !node.selectionSet) {
                    // we make this assertion because proxy-resolver always wraps the selection into the field
                    throw new Error('Unexpected top-level selection set, should be one field with selections');
                }
                return node.selectionSet;
            }
        });
    }

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


/**
 * Determines whether the given type is one of the operation root types (query, mutation, subscription) of a schema
 */
function isRootTypeName(type: string, schema: GraphQLSchema) {
    const mut = schema.getMutationType();
    const sub = schema.getSubscriptionType();
    return type == schema.getQueryType().name ||
        (mut && type == mut.name) ||
        (sub && type == sub.name);
}
