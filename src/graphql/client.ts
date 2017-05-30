import fetch from "node-fetch";
import TraceError = require('trace-error');

export async function query(url: string, query: string): Promise<any> {
    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query
            })
        });
    } catch (error) {
        throw new TraceError(`Error connecting to GraphQL endpoint at ${url}: ${error.message}`, error)
    }
    if (!res.ok) {
        throw new Error(`GraphQL endpoint at ${url} reported ${res.status} ${res.statusText}`);
    }

    let json;
    try {
        json = await res.json<any>();
    } catch (error) {
        throw new TraceError(`Response from GraphQL endpoint at ${url} is invalid json: ${error.message}`, error);
    }
    if ('errors' in json && json['errors'].length) {
        // TODO properly handle multiple errors
        const errObj = json['errors'][0];
        if (errObj && errObj.message) {
            const error = new Error(errObj.message);
            Object.assign(error, errObj);
            throw error;
        } else {
            throw new Error(`GraphQL endpoint reported an error without a message`);
        }
    }
    return json.data;
}
