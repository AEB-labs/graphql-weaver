import { GraphQLHTTPTestEndpoint } from '../helpers/grapqhl-http-test/graphql-http-test-endpoint';

// to get through firewall
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

new GraphQLHTTPTestEndpoint().start(1337).catch(error => {
    console.error(error.stack);
});

