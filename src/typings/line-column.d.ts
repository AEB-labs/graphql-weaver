declare module 'line-column' {
    class LineColumnFinder {
        /**
         * Finder for index and line-column from given string.
         *
         * You can call this without `new` operator as it returns an instance anyway.
         *
         * @class
         * @param {string} str - A string to be parsed.
         * @param {Object|number} [options] - Options.
         *     This can be an index in the string for shorthand of `lineColumn(str, index)`.
         * @param {number} [options.origin=1] - The origin value of line and column.
         */
        constructor(str: string, options?: { origin?: number });

        /**
         * Find line and column from index in the string.
         *
         * @param  {number} index - Index in the string. (0-origin)
         * @return {Object|null}
         *     Found line number and column number in object `{ line: X, col: Y }`.
         *     If the given index is out of range, it returns `null`.
         */
        fromIndex(index: number): { line: number, col: number }|null;

        /**
         * Find index from line and column in the string.
         *
         * @param  {number|Object|Array} line - Line number in the string.
         *     This can be an Object of `{ line: X, col: Y }`, or
         *     an Array of `[line, col]`.
         * @param  {number} [column] - Column number in the string.
         *     This must be omitted or undefined when Object or Array is given
         *     to the first argument.
         * @return {number}
         *     Found index in the string. (always 0-origin)
         *     If the given line or column is out of range, it returns `-1`.
         */
        toIndex(line: number, column: number): number;
        toIndex(lineColumn: { line: number, col: number }): number;
    }

    export = LineColumnFinder;
}