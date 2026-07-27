import {NATR} from './NATR.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('NATR', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L297-L301
   */
  const candles = [
    {close: 81.59, high: 82.15, low: 81.29},
    {close: 81.06, high: 81.89, low: 80.64},
    {close: 82.87, high: 83.03, low: 81.31},
    {close: 83.0, high: 83.3, low: 82.65},
    {close: 83.61, high: 83.85, low: 83.07},
    {close: 83.15, high: 83.9, low: 83.11},
    {close: 82.84, high: 83.33, low: 82.49},
    {close: 83.99, high: 84.3, low: 82.3},
    {close: 84.55, high: 84.84, low: 84.15},
    {close: 84.36, high: 85.0, low: 84.11},
    {close: 85.53, high: 85.9, low: 84.03},
    {close: 86.54, high: 86.58, low: 85.39},
    {close: 86.89, high: 86.98, low: 85.76},
    {close: 87.77, high: 88.0, low: 87.17},
    {close: 87.29, high: 87.87, low: 87.01},
  ] as const;
  const expectations = [
    '1.335',
    '1.264',
    '1.218',
    '1.437',
    '1.343',
    '1.288',
    '1.453',
    '1.424',
    '1.416',
    '1.374',
    '1.302',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const natr = new NATR(5);

      natr.updates(candles, false);

      const originalValue = {close: 89.0, high: 90.0, low: 88.0} as const;
      const replacedValue = {close: 83.0, high: 84.0, low: 82.0} as const;

      const originalResult = natr.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('1.63');

      const replacedResult = natr.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('2.37');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = natr.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const natr = new NATR(interval);
      const offset = natr.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = natr.add(candle);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(natr.isStable).toBe(true);
      expect(natr.getRequiredInputs()).toBe(interval);
    });

    it('throws an error when there is not enough input data', () => {
      const natr = new NATR(5);

      try {
        natr.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
