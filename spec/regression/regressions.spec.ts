import * as fs from "fs";
import * as path from "path";
import {graphql} from "graphql";
import {testConfigWithQuery} from "./helpers";
import {TO_EQUAL_JSON_MATCHERS} from "../helpers/equal-json";
import {GraphQLHTTPTestEndpoint} from "../helpers/grapqhl-http-test/graphql-http-test-endpoint";

declare function require(name:string): any;

describe('regression tests', () => {

    const httpTestEndpoint = new GraphQLHTTPTestEndpoint()

    beforeAll(async() => {
        jasmine.addMatchers(TO_EQUAL_JSON_MATCHERS);
        httpTestEndpoint.start(1337);
    });

    const dir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dir);

    for (const fileName of files) {
        if (!fileName.endsWith('.graphql')) {
            continue;
        }
        const queryString = fs.readFileSync(path.join(dir, fileName), 'utf-8');
        it(fileName, async() => {
            const configFile = require(path.join(dir, fileName.replace(/.graphql$/, '.config.ts')));
            const expectedResult = JSON.parse(fs.readFileSync(path.join(dir, fileName.replace(/.graphql$/, '.result.json')), 'utf-8'));
            const variablesPath = path.join(dir, fileName.replace(/.graphql$/, '.variables.json'));
            const variableValues = fs.exists(variablesPath) ? JSON.parse(fs.readFileSync(variablesPath, 'utf-8')) : {};
            const result = await testConfigWithQuery(await configFile.getConfig(), queryString, variableValues);
            (<any>expect(result)).toEqualJSON(expectedResult);
        });
    }

    afterAll(async() => {
        httpTestEndpoint.stop();
    })

});
