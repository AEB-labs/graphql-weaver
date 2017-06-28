import { GraphQLObjectType, GraphQLString } from 'graphql';
import { walkFields } from '../../src/graphql/schema-utils';

describe('schema-utils', () => {
    describe('walkFields', () => {
        const type = new GraphQLObjectType({
            name: 'Type',
            fields: {
                scalar: {
                    type: GraphQLString
                }
            }
        });

        const type2 = new GraphQLObjectType({
            name: 'Type2',
            fields: {
                inner: {
                    type
                }
            }
        });

        it('finds single field', () => {
            const result = walkFields(type, ['scalar']);
            expect(result).toBeDefined('field not found');
            expect(result!.name).toBe('scalar');
        });

        it('finds nested field', () => {
            const result = walkFields(type2, ['inner', 'scalar']);
            expect(result).toBeDefined('field not found');
            expect(result!.name).toBe('scalar');
        });

        it('returns undefined when not found', () => {
            const result = walkFields(type2, ['inner', 'not-found']);
            expect(result).toBeUndefined('field found but should not exist');
        });

        it('returns undefined when inner type is scalar type', () => {
            const result = walkFields(type, ['scalar', 'some-field']);
            expect(result).toBeUndefined('field found but should not exist');
        });
    });
});
