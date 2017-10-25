export enum WeavingErrorHandlingMode {
    /**
     * All errors are directly thrown in weaveSchemas
     */
    THROW,

        /**
         * Errors are ignored. If the endpoint schema cannot be created at all, it will be missing in the result config.
         * If you are using weaveSchemasExt, errors are included in its result.
         */
    CONTINUE,

        /**
         * Like CONTINUE, but errors are additionally displayed to the user via a special _errors field on the root
         * query type.
         */
    CONTINUE_AND_PROVIDE_IN_SCHEMA,

        /**
         * Like CONTINUE_AND_PROVIDE_IN_SCHEMA, but namespaced endpoints that completely fail are also replaced by an object
         * with a field _error.
         */
    CONTINUE_AND_ADD_PLACEHOLDERS
}

const DEFAULT_ERROR_HANDLING_MODE = WeavingErrorHandlingMode.THROW;

export function shouldAddPlaceholdersOnError(errorHandling: WeavingErrorHandlingMode = DEFAULT_ERROR_HANDLING_MODE) {
    return errorHandling == WeavingErrorHandlingMode.CONTINUE_AND_ADD_PLACEHOLDERS;
}

export function shouldProvideErrorsInSchema(errorHandling: WeavingErrorHandlingMode = DEFAULT_ERROR_HANDLING_MODE) {
    return errorHandling == WeavingErrorHandlingMode.CONTINUE_AND_PROVIDE_IN_SCHEMA || errorHandling == WeavingErrorHandlingMode.CONTINUE_AND_ADD_PLACEHOLDERS;
}

export function shouldContinueOnError(errorHandling: WeavingErrorHandlingMode = DEFAULT_ERROR_HANDLING_MODE) {
    return errorHandling != WeavingErrorHandlingMode.THROW;
}
