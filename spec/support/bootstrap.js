// This file is executed before all specs and before all other handlers

// Enable typescript compilation for .ts files
require('ts-node/register');

// Patch jasmine so that async tests can just return promises (or use the async keyword) and do not need to call done()
global.jasmineRequire = {}; // jasmine-promise expects this be there and patches it, but it is not required
require('jasmine-promises');

// to get through firewall
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
