declare module "trace-error" {
    class Exception {
        stack: string;
        name: string;
        message: string;
        toJSON(): string;
    }

    class TraceError extends Exception {
        messages(): string[];
        causes(): any[];
        cause(index: number): any;

        constructor(message: string, ...causes: any[]);
    }

    export = TraceError;
}