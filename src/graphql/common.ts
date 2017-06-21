import { DocumentNode } from 'graphql';

export type Query = { document: DocumentNode, variableValues: {[name: string]: any}}
