import {GraphQLID, GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString, valueFromAST} from "graphql";
import * as fs from 'fs-extra';
import * as path from "path";
import {testTypes} from "../test-types";

export const defaultTestSchema = new GraphQLSchema({
    query: new GraphQLObjectType({
        name: 'Query',
        fields: {
            allCountries: {
                type: new GraphQLList(testTypes.countryType),
                resolve: async (obj, args) => {
                    if (args.filter && args.filter.identCode_in) {
                        return (await allCountries()).filter(country => args.filter.identCode_in.includes(country.identCode))
                    }
                    return await allCountries();
                },
                args: {
                    filter: { type: testTypes.countryFilterType },
                }
            },
            Country: {
                type: testTypes.countryType,
                resolve: async (obj, args) => {
                    if (args.id) return await objectById(args.id, await allCountries());
                    if (args.identCode) return await countryByIdentCode(args.identCode);
                    return undefined;
                },
                args: {
                    identCode: { type: GraphQLString },
                    id: { type: GraphQLString }
                }
            }
        }
    })
});

function objectById(id: string, objects: [{id:string}]) {
    return objects.filter(value => value.id == id)[0];
}

async function countryByIdentCode(identCode: string) {
    return (await allCountries()).filter(value => value.identCode === identCode)[0];
}

async function allCountries() { return <[{id:string,identCode:string,isoCode:string,description:string}]> await readTestDataFromJson('countries.json'); }
// async function allDeliveries() { return await readTestDataFromJson('deliveries.json') }

async function readTestDataFromJson(filename: string) {
    const json: string = await fs.readFile(path.resolve(__dirname, filename), 'utf-8');
    return <[{id:string}]> JSON.parse(json).data;
}