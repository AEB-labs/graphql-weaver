import { PipelineModule } from './pipeline-module';
import { GraphQLScalarType } from 'graphql';
import { SchemaTransformer } from 'graphql-transformer';

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
    if (value == undefined || value == null) {
        return false;
    }
    return value
}

function parseLiteral(value: any) {
    if (value == undefined || value == null) {
        return false;
    }
    return value
}
