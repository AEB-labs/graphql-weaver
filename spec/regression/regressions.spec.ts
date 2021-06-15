import * as fs from 'fs';
import { formatError, GraphQLError, GraphQLFormattedError } from 'graphql';
import * as path from 'path';
import { TO_EQUAL_JSON_MATCHERS } from '../helpers/equal-json';
import { GraphQLHTTPTestEndpoint } from '../helpers/grapqhl-http-test/graphql-http-test-endpoint';
import { testConfigWithQuery } from './helpers';

declare function require(name:string): any;

describe('regression tests', () => {

    const httpTestEndpoint = new GraphQLHTTPTestEndpoint()

    beforeAll(async() => {
        jasmine.addMatchers(TO_EQUAL_JSON_MATCHERS);
        await httpTestEndpoint.start(1337);
    });

    const dir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dir);

    const saveActualAsExpected = process.argv.includes('--save-actual-as-expected');

    for (const fileName of files) {
        if (!fileName.endsWith('.graphql')) {
            continue;
        }
        const queryString = fs.readFileSync(path.join(dir, fileName), 'utf-8');
        it(fileName, async() => {
            const configFile = require(path.join(dir, fileName.replace(/.graphql$/, '.config.ts')));
            const resultPath = path.join(dir, fileName.replace(/.graphql$/, '.result.json'));
            let expectedResult = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
            const variablesPath = path.join(dir, fileName.replace(/.graphql$/, '.vars.json'));
            const variableValues = fs.existsSync(variablesPath) ? JSON.parse(fs.readFileSync(variablesPath, 'utf-8')) : {};
            const result = await testConfigWithQuery(await configFile.getConfig(), queryString, variableValues);

            if (saveActualAsExpected) {
                if (!jasmine.matchersUtil.equals(result.data, expectedResult.data) || !jasmine.matchersUtil.equals(sortAndNormalizeErrors(result.errors), sortAndNormalizeErrors(expectedResult.errors))) {
                    fs.writeFileSync(resultPath, JSON.stringify(result, undefined, '  '), 'utf-8');
                }
            }

            (<any>expect(result.data)).toEqualJSON(expectedResult.data);
            (<any>expect(sortAndNormalizeErrors(result.errors))).toEqualJSON(sortAndNormalizeErrors(expectedResult.errors));
        });
    }

    afterAll(async() => {
        httpTestEndpoint.stop();
    })

});

function sortAndNormalizeErrors(errors: ReadonlyArray<GraphQLError>|undefined) {
    if (!errors || !errors.length) {
        return errors;
    }
    return errors.map(err => formatError(err)).sort(compareErrors);
}

function compareErrors(a: GraphQLFormattedError, b: GraphQLFormattedError) {
    const path1 = a.path ? a.path.join('.') : undefined;
    const path2 = b.path ? b.path.join('.') : undefined;
    if (path1 && path2) {
        if (path1 < path2) {
            return -1;
        }
        if (path1 > path2) {
            return 1;
        }
    }
    const json1 = JSON.stringify(a);
    const json2 = JSON.stringify(a);
    if (json1 < json2) {
        return -1;
    }
    if (json1 > json2) {
        return 1;
    }
    return 0;
}
