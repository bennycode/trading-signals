import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {TRIMA} from './TRIMA.js';

describe('TRIMA', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L418-L420
   */
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = [
    '82.437',
    '82.908',
    '83.204',
    '83.260',
    '83.440',
    '83.807',
    '84.302',
    '84.863',
    '85.537',
    '86.288',
    '86.901',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const trima = new TRIMA(5);

      trima.updates(prices, false);

      const originalValue = 90;
      const replacedValue = 83;

      const originalResult = trima.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('87.58');

      const replacedResult = trima.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('86.80');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = trima.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const trima = new TRIMA(interval);
      const offset = trima.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = trima.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(trima.isStable).toBe(true);
      expect(trima.getRequiredInputs()).toBe(interval);
    });

    it('repeats the peak weight when the interval is even', () => {
      const evenExpectations = [
        '82.641',
        '82.981',
        '83.235',
        '83.393',
        '83.655',
        '84.058',
        '84.596',
        '85.228',
        '85.919',
        '86.545',
      ] as const;
      const trima = new TRIMA(6);
      const offset = trima.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = trima.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(evenExpectations[i - offset]);
        }
      });

      expect(trima.isStable).toBe(true);
    });

    it('weights all prices equally when the interval is too short to form a triangle', () => {
      const trima = new TRIMA(2);

      trima.add(3);
      trima.add(5);

      expect(trima.getResultOrThrow()).toBe(4);

      trima.add(9);

      expect(trima.getResultOrThrow()).toBe(7);
    });
  });
});

testIndicatorContract({
  create: () => new TRIMA(5),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29],
});
