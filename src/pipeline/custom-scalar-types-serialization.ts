import { PipelineModule } from './pipeline-module';
import {
    GraphQLBoolean, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLNamedType, GraphQLScalarType, GraphQLSchema,
    GraphQLString,
    GraphQLType
} from "graphql";
import {objectValues} from "../utils/utils";
import {SchemaTransformer} from "../graphql/schema-transformer";

/**
 * Overwrite the default behaviour from generateClientSchema which sets values of custom scalar types to false.
 * As types don't have to be serialized, just pass them through.
 */
export class CustomScalarTypesSerializationModule implements PipelineModule {

    getSchemaTransformer() {
        return new CustomScalarTypesSerializationTransformer();
    }

}

export class CustomScalarTypesSerializationTransformer implements SchemaTransformer {

    transformScalarType(type: GraphQLScalarType): GraphQLScalarType {
        return {
            ...type,
            parseValue: parseValue,
            parseLiteral: parseLiteral
        } as GraphQLScalarType;
    }
}

function parseValue(value: any) {
    return value || false;
}

function parseLiteral(value: any) {
    return value || false;
}
