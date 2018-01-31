import { PipelineModule } from './pipeline-module';
import { GraphQLScalarType } from 'graphql';
import { SchemaTransformer } from 'graphql-transformer';
import GraphQLJSON = require('graphql-type-json');

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
        // parseLiteral needs to parse all possible InputValues to its corresponding JSON value. the JSON scalar
        // implementation does exactly. this. parseLiteral and serialize are the identity function.
        return {
            ...type,
            parseValue: (value) => GraphQLJSON.parseValue(value),
            parseLiteral: (value) => GraphQLJSON.parseLiteral(value),
            serialize: (value) => GraphQLJSON.serialize(value)
        } as GraphQLScalarType;
    }
}
