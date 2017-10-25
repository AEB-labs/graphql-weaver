import { GraphQLSchema } from 'graphql';
import { WeavingError } from './config/errors';

export interface WeavingResult {
    /**
     * The woven schema. Is always a GraphQLSchema instance, even in the presence of errors.
     */
    schema: GraphQLSchema

    /**
     * Recoverable errors that occurred while weaving. Only populated if errorHandling is not THROW.
     */
    errors: WeavingError[]

    /**
     * Indicates whether errors is non-empty
     */
    hasErrors: boolean
}
