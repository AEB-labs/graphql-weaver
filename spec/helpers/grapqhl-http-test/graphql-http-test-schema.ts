import { GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import * as fs from 'fs-extra';
import * as path from 'path';
import { testTypes } from '../test-types';

const allCountries = getAllCountries();
const allPeople = getAllPeople();

function comparator(orderBy: string) {
    let dir: number;
    let field: string;
    if (orderBy.endsWith('_ASC')) {
        field = orderBy.substr(0, orderBy.length - '_ASC'.length);
        dir = 1;
    } else if (orderBy.endsWith('_DESC')) {
        field = orderBy.substr(0, orderBy.length - '_DESC'.length);
        dir = -1;
    } else {
        return (a: any) => 0;
    }

    function compareAsc(lhs: any, rhs: any) {
        const lhsValue = lhs[field];
        const rhsValue = rhs[field];
        if (lhsValue == null && rhsValue != null) {
            return -1;
        }
        if (rhsValue == null && lhsValue != null) {
            return 1;
        }
        if (lhsValue < rhsValue) {
            return -1;
        }
        if (lhsValue > rhsValue) {
            return 1;
        }
        return 0;
    }

    return (lhs: any, rhs: any) => compareAsc(lhs, rhs) * dir;
}

export const defaultTestSchema = new GraphQLSchema({
    query: new GraphQLObjectType({
        name: 'Query',
        fields: {
            allCountries: {
                type: new GraphQLList(testTypes.countryType),
                resolve: async (obj, args) => {
                    let countries = await allCountries;
                    if (args.filter && args.filter.identCode_in) {
                        countries = countries.filter(country => args.filter.identCode_in.includes(country.identCode));
                    }
                    if (args.filter && args.filter.continent) {
                        countries = countries.filter(country => args.filter.continent == country.continent);
                    }
                    if (args.orderBy) {
                        countries = [...countries].sort(comparator(args.orderBy));
                    }
                    return countries;
                },
                args: {
                    filter: {type: testTypes.countryFilterType},
                    orderBy: {type: testTypes.countryOrderType}
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
                    if (args.orderBy) {
                        people = [...people].sort(comparator(args.orderBy));
                    }
                    return people;
                },
                args: {
                    filter: {type: testTypes.personFilterType},
                    orderBy: {type: testTypes.personOrderType}
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
    return <{ id: string, identCode: string, isoCode: string, description: string, continent?: string }[]> await readTestDataFromJson('countries.json');
}

// async function allDeliveries() { return await readTestDataFromJson('deliveries.json') }

async function getAllPeople() {
    return <{ name: string, nationality: string, isCool?: boolean }[]> await readTestDataFromJson('people.json');
}

async function readTestDataFromJson(filename: string) {
    const json: string = await fs.readFile(path.resolve(__dirname, filename), 'utf-8');
    return JSON.parse(json).data;
}
