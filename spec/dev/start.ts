import {start} from "../helpers/server";

// to get through firewall
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

start().catch(error => {
    console.error(error.stack);
});
