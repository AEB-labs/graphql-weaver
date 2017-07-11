import {
    ASTNode, getNamedType, GraphQLArgument, GraphQLField, GraphQLFieldConfigArgumentMap, GraphQLInputFieldConfigMap,
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLInterfaceType,
    GraphQLObjectType
} from 'graphql';
import { PipelineModule } from './pipeline-module';
import { ExtendedSchema } from '../extended-schema/extended-schema';
import {
    ExtendedSchemaTransformer, GraphQLNamedFieldConfigWithMetadata, transformExtendedSchema
} from '../extended-schema/extended-schema-transformer';
import { FieldTransformationContext } from '../graphql/schema-transformer';
import { isListType } from '../graphql/schema-utils';
import { throwError } from '../utils/utils';
import { parseLinkTargetPath } from './helpers/link-helpers';
import DataLoader = require('dataloader');

const FILTER_ARG = 'filter';
const ORDER_BY_ARG = 'orderBy';

/**
 * Adds a feature to join filters, ordering and limiting of a linked field into the parent field
 */
export class JoinModule implements PipelineModule {
    private oldSchema: ExtendedSchema | undefined;
    private newSchema: ExtendedSchema | undefined;

    transformExtendedSchema(schema: ExtendedSchema): ExtendedSchema {
        this.oldSchema = schema;
        this.newSchema = transformExtendedSchema(schema, new SchemaJoinTransformer(schema));
        return this.newSchema!;
    }

    /**
     * TODO
     */
    transformNode(node: ASTNode): ASTNode {
        if (!this.newSchema || !this.oldSchema) {
            throw new Error(`Schema is not built yet`);
        }

        return node;
    }
}

class SchemaJoinTransformer implements ExtendedSchemaTransformer {
    constructor(private readonly schema: ExtendedSchema) {

    }

    transformField(config: GraphQLNamedFieldConfigWithMetadata<any, any>, context: FieldTransformationContext): GraphQLNamedFieldConfigWithMetadata<any, any> {
        if (!config.metadata || !config.metadata.join) {
            return config;
        }

        const linkFieldName = config.metadata.join.linkField;
        const outerType = getNamedType(context.oldField.type);
        if (!(outerType instanceof GraphQLObjectType) && !(outerType instanceof GraphQLInterfaceType)) {
            throw new Error(`@join feature only supported on object types and interface types, but is ${outerType}`);
        }
        const linkField: GraphQLField<any, any> = outerType.getFields()[linkFieldName]; // why any?
        if (!linkField) {
            throw new Error(`linkField ${JSON.stringify(linkFieldName)} configured by @join does not exist on ${outerType.name}`);
        }
        const linkFieldMetadata = this.schema.getFieldMetadata(<GraphQLObjectType>outerType, linkField); // no metadata on interfaces yet
        const linkConfig = linkFieldMetadata ? linkFieldMetadata.link : undefined;
        if (!linkConfig) {
            throw new Error(`Field ${outerType.name}.${linkFieldName} is referenced as linkField but has no @link configuration`);
        }
        const {fieldPath: targetFieldPath, field: targetField} = parseLinkTargetPath(linkConfig.field, this.schema.schema) ||
        throwError(`Link on ${context.oldOuterType}.${config.name} defines target field as ${linkConfig.field} which does not exist in the schema`);

        if (isListType(linkField.type)) {
            throw new Error(`@join not available for linkFields with array type (${context.oldOuterType}.${config.name} specifies @join with linkName ${linkFieldName}`);
        }

        const leftObjectType = getNamedType(context.oldField.type);

        // terminology: left and right in the sense of a SQL join (left is link, right is target)


        // filter
        const leftFilterArg = context.oldField.args.filter(arg => arg.name == FILTER_ARG)[0];
        const rightFilterArg = targetField.args.filter(arg => arg.name == FILTER_ARG)[0];

        let newFilterType: GraphQLInputType|undefined;
        if (rightFilterArg) {
            const newFilterTypeName = leftObjectType.name + 'Filter';
            let newFilterFields: GraphQLInputFieldConfigMap;
            if (!leftFilterArg) {
                newFilterFields = {
                    [linkFieldName]: {
                        type: context.mapType(rightFilterArg.type)
                    }
                };
            } else {
                const leftFilterType = context.mapType(leftFilterArg.type);
                if (!(leftFilterType instanceof GraphQLInputObjectType)) {
                    throw new Error(`Expected filter argument of ${outerType.name}.${linkField.name} to be of InputObjectType`);
                }

                newFilterFields = {
                    ...leftFilterType.getFields(),
                    [linkFieldName]: {
                        type: context.mapType(rightFilterArg.type)
                    }
                };
            }
            newFilterType = new GraphQLInputObjectType({
                name: newFilterTypeName,
                fields: newFilterFields
            });
        } else {
            newFilterType = leftFilterArg ? leftFilterArg.type : undefined;
        }

        let newArguments: GraphQLFieldConfigArgumentMap = config.args || {};

        if (newFilterType) {
            newArguments = {
                ...newArguments,
                [FILTER_ARG]: {
                    type: newFilterType
                }
            }
        }

        const leftOrderByArg = linkField.args.filter(arg => arg.name == ORDER_BY_ARG)[0];
        const rightOrderByArg = targetField.args.filter(arg => arg.name == ORDER_BY_ARG)[0];

        return {
            ...config,
            args: newArguments
        };
    }
}
