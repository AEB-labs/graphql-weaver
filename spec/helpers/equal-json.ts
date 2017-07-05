import CustomMatcher = jasmine.CustomMatcher;
import CustomMatcherResult = jasmine.CustomMatcherResult;
import CustomMatcherFactories = jasmine.CustomMatcherFactories;
const jsondiffpatch = require('jsondiffpatch');

// thanks to https://github.com/jasmine/jasmine/issues/675#issuecomment-127187623
export const TO_EQUAL_JSON_MATCHERS: CustomMatcherFactories = {
    toEqualJSON: function(util, customEqualityTesters): CustomMatcher {
        return {
            compare: function(actual: any, expected: any): CustomMatcherResult {
                actual = JSON.parse(JSON.stringify(actual));
                expected = JSON.parse(JSON.stringify(expected));
                const pass = util.equals(actual, expected, customEqualityTesters);
                return {
                    pass,
                    message: pass ? 'ok' : 'JSON objects not equal. \r\nACTUAL:\r\n'+ JSON.stringify(actual, null, "\t") +'\r\nEXPECTED:\r\n:' + JSON.stringify(expected, null, "\t") + '\r\nDIFF:\r\n' + jsondiffpatch.formatters.console.format(jsondiffpatch.diff(expected, actual))
                };
            },
        };
    }
};