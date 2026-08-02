import {TypicalPrice} from './TypicalPrice.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('TypicalPrice', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L434-L438
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
    '81.677',
    '81.197',
    '82.403',
    '82.983',
    '83.510',
    '83.387',
    '82.887',
    '83.530',
    '84.513',
    '84.490',
    '85.153',
    '86.170',
    '86.543',
    '87.647',
    '87.390',
  ] as const;

  describe('getResultOrThrow', () => {
    it('calculates the Typical Price (TYPPRICE)', {tags: ['tulipindicators']}, () => {
      const typicalPrice = new TypicalPrice();

      candles.forEach((candle, i) => {
        typicalPrice.add(candle);
        expect(typicalPrice.getResultOrThrow().toFixed(3)).toBe(expectations[i]);
      });

      expect(typicalPrice.isStable).toBe(true);
      expect(typicalPrice.getRequiredInputs()).toBe(1);
    });

    it('throws an error when there is not enough input data', () => {
      const typicalPrice = new TypicalPrice();

      try {
        typicalPrice.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('is stable after a single candle', () => {
      const typicalPrice = new TypicalPrice();

      expect(typicalPrice.isStable).toBe(false);

      typicalPrice.add(candles[0]);

      expect(typicalPrice.isStable).toBe(true);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const typicalPrice = new TypicalPrice();

      candles.slice(0, -1).forEach(candle => {
        typicalPrice.add(candle);
      });

      const originalValue = {close: 87.29, high: 87.87, low: 87.01} as const;
      const replacedValue = {close: 90.0, high: 91.5, low: 89.4} as const;

      const originalResult = typicalPrice.add(originalValue);

      expect(originalResult?.toFixed(3)).toBe('87.390');

      const replacedResult = typicalPrice.replace(replacedValue);

      expect(replacedResult?.toFixed(3)).toBe('90.300');

      const restoredResult = typicalPrice.replace(originalValue);

      expect(restoredResult?.toFixed(3)).toBe('87.390');
    });
  });

  describe('keeps the bar range in the price', () => {
    it('separates two candles that share a close but travelled differently', () => {
      const closedAtLow = new TypicalPrice();
      const closedAtHigh = new TypicalPrice();

      closedAtLow.add({close: 100, high: 110, low: 100});
      closedAtHigh.add({close: 100, high: 100, low: 90});

      expect(
        closedAtLow.getResultOrThrow().toFixed(2),
        'a bar that ran up to 110 and gave it all back sits above its close'
      ).toBe('103.33');
      expect(
        closedAtHigh.getResultOrThrow().toFixed(2),
        'a bar that dropped to 90 and recovered sits below its close'
      ).toBe('96.67');
    });
  });
});
