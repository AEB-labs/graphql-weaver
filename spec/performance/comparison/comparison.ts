import { WeavingConfig } from '../../../src/config/weaving-config';
import * as fs from 'fs';
import { BenchmarkConfig } from '../support/async-bench';
import { weaveSchemas } from '../../../src/weave-schemas';
import { execute, graphql, GraphQLSchema, parse } from 'graphql';
import { HttpGraphQLClient } from '../../../src/graphql-client/http-client';
import * as path from 'path';
import { assertSuccessfulResult } from '../../../src/graphql/execution-result';

const UPSTREAM_URL = 'http://localhost:1337/graphql';
const queryStr = fs.readFileSync(path.resolve(__dirname, 'query.graphql'), 'utf-8');

const config: WeavingConfig = {
    endpoints: [
        {
            url: UPSTREAM_URL
        }
    ]
};

function testDirect(params: { useLargeList?: boolean} = {}): BenchmarkConfig {
    const client = new HttpGraphQLClient({ url: UPSTREAM_URL });
    const document = parse(queryStr);

    return {
        name: `direct ${params && params.useLargeList ? 'with large list' : ''}`,
        maxTime: 5,
        async fn() {
            const result = await client.execute(document, params);
            assertSuccessfulResult(result);
        }
    };
}

function testProxied(params: { useLargeList?: boolean} = {}): BenchmarkConfig {
    let schema: GraphQLSchema;
    return {
        name: `woven ${params && params.useLargeList ? 'with large list' : ''}`,
        maxTime: 5,
        async fn() {
            const result = await graphql(schema, queryStr, {}, {}, params);
            assertSuccessfulResult(result);
        },
        async beforeAll() {
            schema = await weaveSchemas(config);
        }
    };
}

export const COMPARISON: BenchmarkConfig[] = [
    testDirect({ useLargeList: false }), testProxied({ useLargeList: false })
];

export const COMPARISON_LARGE: BenchmarkConfig[] = [
    testDirect({ useLargeList: true }), testProxied({ useLargeList: true })
];
