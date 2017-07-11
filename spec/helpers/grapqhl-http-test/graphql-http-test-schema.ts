import { GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import * as fs from 'fs-extra';
import * as path from 'path';
import { testTypes } from '../test-types';

const allCountries = getAllCountries();
const allPeople = getAllPeople();

export const defaultTestSchema = new GraphQLSchema({
    query: new GraphQLObjectType({
        name: 'Query',
        fields: {
            allCountries: {
                type: new GraphQLList(testTypes.countryType),
                resolve: async (obj, args) => {
                    if (args.filter && args.filter.identCode_in) {
                        return (await allCountries).filter(country => args.filter.identCode_in.includes(country.identCode));
                    }
                    return await allCountries;
                },
                args: {
                    filter: {type: testTypes.countryFilterType}
                }
            },
            Country: {
                type: testTypes.countryType,
                resolve: async (obj, args) => {
                    if (args.id) {
                        return await objectById(args.id, await allCountries);
                    }
                    if (args.identCode) {
                        return await countryByIdentCode(args.identCode);
                    }
                    return undefined;
                },
                args: {
                    identCode: {type: GraphQLString},
                    id: {type: GraphQLString}
                }
            },
            allPeople: {
                type: new GraphQLList(testTypes.personType),
                resolve: async (obj, args) => {
                    let people = await allPeople;
                    if (args.filter && args.filter.isCool != undefined) {
                        people = people.filter(person => args.filter.isCool === person.isCool);
                    }
                    return await people;
                },
                args: {
                    filter: {type: testTypes.personFilterType}
                }
            }
        }
    })
});

function objectById(id: string, objects: { id: string }[]) {
    return objects.filter(value => value.id == id)[0];
}

async function countryByIdentCode(identCode: string) {
    return (await allCountries).filter(value => value.identCode === identCode)[0];
}

async function getAllCountries() {
    return <{ id: string, identCode: string, isoCode: string, description: string }[]> await readTestDataFromJson('countries.json');
}
// async function allDeliveries() { return await readTestDataFromJson('deliveries.json') }

async function getAllPeople() {
    return <{ name: string, nationality: string, isCool?: boolean }[]> await readTestDataFromJson('people.json');
}

async function readTestDataFromJson(filename: string) {
    const json: string = await fs.readFile(path.resolve(__dirname, filename), 'utf-8');
    return JSON.parse(json).data;
}
