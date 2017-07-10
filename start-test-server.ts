import {start} from "./src/server";
import {GraphQLHTTPTestEndpoint} from "./spec/helpers/grapqhl-http-test/graphql-http-test-endpoint";

// to get through firewall
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

new GraphQLHTTPTestEndpoint().start(1337);
