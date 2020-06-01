import {Big as BigNumber} from 'big.js';
import {ROC} from './ROC';
import {NotEnoughDataError} from '../error';

const prices = [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29];
/*************************************************
 Result calculation:
 Close | Calculation             | Result
 ------------------------------------------------
 81.59 | ----------------------- | Unstable (null)
 81.06 | ----------------------- | Unstable (null)
 82.87 | ----------------------- | Unstable (null)
 83.00 | ----------------------- | Unstable (null)
 83.61 | ----------------------- | Unstable (null)
 83.15 | (83.15 - 81.59) / 81.59 | 0.01911999019
 82.84 | (82.84 - 81.06) / 81.06 | 0.02195904268
 83.99 | (83.99 - 82.87) / 82.87 | 0.0135151442
 84.55 | (84.55 - 83.00) / 83.00 | 0.01867469879
 84.36 | (84.36 - 83.61) / 83.61 | 0.00897021887
 85.53 | (85.53 - 83.15) / 83.15 | 0.02862297053
 86.54 | (86.54 - 82.84) / 82.84 | 0.04466441332
 86.89 | (86.89 - 83.99) / 83.99 | 0.03452791999
 87.77 | (87.77 - 84.55) / 84.55 | 0.03808397397
 87.29 | (87.29 - 84.36) / 84.36 | 0.03473210052
 *************************************************/
const results = [
  null,
  null,
  null,
  null,
  null,
  0.01911999019,
  0.02195904268,
  0.0135151442,
  0.01867469879,
  0.00897021887,
  0.02862297053,
  0.04466441332,
  0.03452791999,
  0.03808397397,
  0.03473210052,
];

describe('ROC', () => {
  describe('getResult', () => {
    it('should correctly calculate ROC with interval 5', () => {
      const roc = new ROC(5);
      prices.forEach((price, index) => {
        roc.update(new BigNumber(price));

        if (!roc.isStable) {
          return;
        }

        const expected = new BigNumber(Number(results[index]));
        expect(roc.getResult().toFixed(2)).toEqual(expected.toFixed(2));
      });
    });

    it('throws an error when there is not enough input data', () => {
      const roc = new ROC(6);

      try {
        roc.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('returns true when it can return reliable data', () => {
      const interval = 5;
      const indicator = new ROC(interval);

      const mockedPrices = [
        new BigNumber('0.00019040'),
        new BigNumber('0.00019071'),
        new BigNumber('0.00019198'),
        new BigNumber('0.00019220'),
        new BigNumber('0.00019214'),
        new BigNumber('0.00019205'),
      ];

      expect(mockedPrices.length).toBe(interval + 1);
      expect(indicator.isStable).toBeFalse();

      mockedPrices.forEach(price => indicator.update(price));

      expect(indicator.isStable).toBeTrue();
    });
  });
});
