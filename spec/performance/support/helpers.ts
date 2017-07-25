import {GraphQLEnvironment, initGraphQLEnvironment, createTempDatabase} from "../../arangodb/initialization";
import {Database} from "arangojs";
import {range} from "../../../src/utils/utils";

// arangojs typings for this are completely broken
export const aql: (template: TemplateStringsArray, ...args: any[]) => any = require('arangojs').aql;

export interface TestEnvironment extends GraphQLEnvironment {
    getDB(): Database;
}

export async function initEnvironment() {
    const config = await createTempDatabase();
    return {
        ...(await initGraphQLEnvironment(config)),
        getDB() {
            return new Database(config)
        }
    };
}


function createLiteratureReference(sizeFactor: number) {
    return {
        title: 'A referenced paper',
        authors: range(sizeFactor).map(index => `Author ${index}`),
        pages: {
            startPage: 5,
            endPage: 10
        }
    };
}

export function createLargePaper(sizeFactor: number): any {
    const sizeSqrt = Math.round(Math.sqrt(sizeFactor));
    return {
        title: 'A paper',
        literatureReferences: range(sizeSqrt).map(() => createLiteratureReference(sizeSqrt)),
        tags: range(sizeFactor).map(index => `Tag ${index}`)
    }
}

export function createUser() {
    return {
        firstName: 'Max',
        lastName: 'Mustermann',
        email: 'max.mustermann@example.com'
    };
}

export function getSizeFactorForJSONLength(jsonLength: number) {
    const sizeFactorPerLength = 100 / JSON.stringify(createLargePaper(100)).length;
    return Math.ceil(sizeFactorPerLength * jsonLength);
}

export async function addPaper(environment: TestEnvironment, paperData: any): Promise<number> {
    const res = await environment.exec(`mutation($input: AddPaperInput!) { addPaper(input: $input) { id } }`, {
        input: paperData
    });
    // TODO change to addPaper.id once mutations no longer return an array
    return res.addPaper[0].id;
}

export async function addManyPapersWithAQL(environment: TestEnvironment, count: number, paperData: any) {
    await environment.getDB().query(aql`FOR i IN 1..${count} INSERT ${paperData} IN papers`);
}

export async function addManyUsersWithAQL(environment: TestEnvironment, count: number, userData: any) {
    await environment.getDB().query(aql`FOR i IN 1..${count} INSERT ${userData} IN users`);
}

export async function getRandomPaperIDsWithAQL(environment: TestEnvironment, count: number): Promise<number[]> {
    const cursor = await environment.getDB().query(aql`FOR node IN papers SORT RAND() LIMIT ${count} RETURN { id: node._key }`);
    const docs = await cursor.all();
    return docs.map(doc => doc.id);
}

export function formatBytes(bytes: number): string {
    if (bytes < 1000) {
        return `${bytes} bytes`;
    }
    const kb = bytes / 1000;
    if (kb < 1000) {
        return `${kb} KB`;
    }
    const mb = kb / 1000;
    if (mb < 1000) {
        return `${mb} MB`;
    }
    const gb = mb / 1000;
    return `${gb} GB`;
}