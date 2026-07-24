import {HMA} from './HMA.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('HMA', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L203-L205
   */
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = [
    '83.690',
    '83.038',
    '83.472',
    '84.550',
    '84.835',
    '85.360',
    '86.552',
    '87.346',
    '87.965',
    '87.916',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const hma = new HMA(5);

      hma.updates(prices, false);

      const originalValue = 90;
      const replacedValue = 83;

      const originalResult = hma.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('89.26');

      const replacedResult = hma.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('84.60');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = hma.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const hma = new HMA(interval);
      const offset = hma.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = hma.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(hma.isStable).toBe(true);
      expect(hma.getRequiredInputs()).toBe(6);
    });

    it('throws an error when there is not enough input data', () => {
      const hma = new HMA(5);

      try {
        hma.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
