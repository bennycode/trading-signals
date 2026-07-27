import {KAMA} from './KAMA.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('KAMA', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L207-L209
   */
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = [
    '83.610',
    '83.560',
    '83.452',
    '83.506',
    '83.647',
    '83.686',
    '84.126',
    '85.026',
    '85.690',
    '86.447',
    '86.673',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const kama = new KAMA(5);

      kama.updates(prices, false);

      const originalValue = 90;
      const replacedValue = 83;

      const originalResult = kama.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('87.72');

      const replacedResult = kama.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('86.38');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = kama.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const kama = new KAMA(interval);
      const offset = kama.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = kama.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(kama.isStable).toBe(true);
      expect(kama.getRequiredInputs()).toBe(interval);
    });

    it('stays on the price level when the market is completely flat', () => {
      const kama = new KAMA(5);

      for (let i = 0; i < 8; i++) {
        kama.add(100);
      }

      expect(kama.getResultOrThrow()).toBe(100);
    });

    it('throws an error when there is not enough input data', () => {
      const kama = new KAMA(5);

      try {
        kama.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
