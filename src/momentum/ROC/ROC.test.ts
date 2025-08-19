import {ROC} from './ROC.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('ROC', () => {
  describe('getResultOrThrow', () => {
    it('identifies an up-trending asset by a positive ROC', () => {
      // Test data verified with:
      // https://tulipindicators.org/roc
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;

      const expectations = [
        0.01911999019, 0.02195904268, 0.0135151442, 0.01867469879, 0.00897021887, 0.02862297053, 0.04466441332,
        0.03452791999, 0.03808397397, 0.03473210052,
      ] as const;

      const interval = 5;
      const roc = new ROC(interval);
      const offset = roc.getRequiredInputs();

      prices.forEach((price, i) => {
        roc.add(price);

        if (roc.isStable) {
          const expected = expectations[i - offset];
          expect(roc.getResultOrThrow().toFixed(2)).toEqual(expected?.toFixed(2));
        }
      });

      expect(roc.getRequiredInputs()).toBe(interval);
    });

    it('identifies a down-trending asset by a negative ROC', () => {
      const roc = new ROC(5);

      const prices = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100];

      prices.forEach(price => {
        roc.add(price);
      });
    });

    it('throws an error when there is not enough input data', () => {
      const roc = new ROC(6);

      try {
        roc.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('returns true when it can return reliable data', () => {
      const interval = 5;
      const indicator = new ROC(interval);
      expect(indicator.isStable).toBe(false);

      const mockedPrices = [0.0001904, 0.00019071, 0.00019198, 0.0001922, 0.00019214, 0.00019205];
      mockedPrices.forEach(price => indicator.add(price));
      expect(indicator.isStable).toBe(true);
    });
  });
});
