import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {ADX} from '../ADX/ADX.js';
import {ADXR} from './ADXR.js';

describe('ADXR', () => {
  /*
   * Test data verified with:
   * https://tulipindicators.org/adxr
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L40-L42
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

  // https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L43
  const expectations = ['50.685', '54.790', '58.389'] as const;

  describe('getResultOrThrow', () => {
    it('calculates the Average Directional Movement Index Rating (ADXR)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const adxr = new ADXR(interval);
      const offset = adxr.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        adxr.add(candle);

        if (adxr.isStable) {
          const expected = expectations[i - offset];
          expect(adxr.getResultOrThrow().toFixed(3)).toBe(expected);
        }
      });

      expect(adxr.isStable).toBe(true);
      expect(adxr.getRequiredInputs()).toBe(13);
      expect(adxr.getResultOrThrow().toFixed(3)).toBe('58.389');
    });

    it('stays below the ADX while trend strength is building, because half of the rating is an older reading', () => {
      const interval = 5;
      const adx = new ADX(interval);
      const adxr = new ADXR(interval);

      for (const candle of candles) {
        adx.add(candle);
        adxr.add(candle);
      }

      /*
       * The series trends harder with every candle, so blending in the older, weaker reading
       * keeps the rating below the current trend strength.
       */
      expect(adxr.getResultOrThrow()).toBeLessThan(adx.getResultOrThrow());
    });
  });

  describe('constructor', () => {
    it("defaults to Wilder's suggested interval of 14", () => {
      const adxr = new ADXR();

      expect(adxr.interval).toBe(14);
      expect(adxr.getRequiredInputs()).toBe(40);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value and restores the original on demand', () => {
      const interval = 5;
      const adxr = new ADXR(interval);

      for (const candle of candles.slice(0, -1)) {
        adxr.add(candle);
      }

      const originalCandle = {close: 87.29, high: 87.87, low: 87.01} as const;
      const divergentCandle = {close: 1_000, high: 1_000, low: 1_000} as const;

      const originalResult = adxr.add(originalCandle);

      expect(originalResult?.toFixed(3)).toBe('58.389');

      const replacedResult = adxr.replace(divergentCandle);

      expect(replacedResult?.toFixed(3)).toBe('60.824');

      const restoredResult = adxr.replace(originalCandle);

      expect(restoredResult?.toFixed(3)).toBe('58.389');
    });
  });

  describe('isStable', () => {
    it('requires at least (3x interval - 2) candles to collect one full interval of ADX readings', () => {
      const interval = 5;
      const necessaryCandlesAmount = 3 * interval - 2;
      const initialCandles = candles.slice(0, necessaryCandlesAmount - 1);
      const adxr = new ADXR(interval);

      for (const candle of initialCandles) {
        adxr.add(candle);
      }

      // The underlying ADX has been stable for a while, but the rating still lacks history
      expect(adxr.isStable).toBe(false);

      adxr.add({close: 10, high: 11, low: 9});

      expect(adxr.isStable).toBe(true);
    });
  });
});

testIndicatorContract({
  create: () => new ADXR(5),
  divergentInput: {close: 1_000, high: 1_000, low: 1_000},
  inputs: [
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
  ],
});
