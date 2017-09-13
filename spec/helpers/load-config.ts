import * as fs from 'fs-extra';
import TraceError = require('trace-error');
import { WeavingConfig } from '../../src/config/weaving-config';

export async function loadProxyConfig(fileName: string): Promise<WeavingConfig> {
    await fs.ensureFile(fileName);
    const contents = await fs.readFile(fileName, 'utf-8');
    let json;
    try {
        json = JSON.parse(contents);
    } catch (error) {
        throw new TraceError(`Config file ${fileName} is not a valid JSON file: ${error.message}`, error);
    }
    return json;
}
