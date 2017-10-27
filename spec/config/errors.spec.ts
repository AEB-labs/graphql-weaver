import { WeavingError } from '../../src/config/errors';

describe('WeavingError', () => {
    it('is instanceof WeavingError', () => {
        expect((new WeavingError('a')) instanceof WeavingError).toBeTruthy();
    });

    it('is instanceof WeavingError after throwing', () => {
        function fn () {
            try {
                throw new WeavingError('a');
            } catch (e) {
                return e;
            }
        }
        expect(fn() instanceof WeavingError).toBeTruthy();
    });
});
