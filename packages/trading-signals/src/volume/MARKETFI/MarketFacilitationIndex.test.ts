import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {MarketFacilitationIndex} from './MarketFacilitationIndex.js';

describe('MarketFacilitationIndex', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L248-L252
   */
  const candles = [
    {close: 81.59, high: 82.15, low: 81.29, volume: 5_653_100},
    {close: 81.06, high: 81.89, low: 80.64, volume: 6_447_400},
    {close: 82.87, high: 83.03, low: 81.31, volume: 7_690_900},
    {close: 83.0, high: 83.3, low: 82.65, volume: 3_831_400},
    {close: 83.61, high: 83.85, low: 83.07, volume: 4_455_100},
    {close: 83.15, high: 83.9, low: 83.11, volume: 3_798_000},
    {close: 82.84, high: 83.33, low: 82.49, volume: 3_936_200},
    {close: 83.99, high: 84.3, low: 82.3, volume: 4_732_000},
    {close: 84.55, high: 84.84, low: 84.15, volume: 4_841_300},
    {close: 84.36, high: 85.0, low: 84.11, volume: 3_915_300},
    {close: 85.53, high: 85.9, low: 84.03, volume: 6_830_800},
    {close: 86.54, high: 86.58, low: 85.39, volume: 6_694_100},
    {close: 86.89, high: 86.98, low: 85.76, volume: 5_293_600},
    {close: 87.77, high: 88.0, low: 87.17, volume: 7_985_800},
    {close: 87.29, high: 87.87, low: 87.01, volume: 4_807_900},
  ] as const;

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      /*
       * Tulip publishes its expectations rounded to three decimals, which flattens every reading of this dataset
       * to "0.000" — dollar-wide ranges against multi-million volumes land near 1e-7. The exponential
       * expectations pin the same values at a precision where a broken formula actually fails.
       */
      const expectations = [
        '1.52129e-7',
        '1.93877e-7',
        '2.23641e-7',
        '1.69651e-7',
        '1.75080e-7',
        '2.08004e-7',
        '2.13404e-7',
        '4.22654e-7',
        '1.42524e-7',
        '2.27313e-7',
        '2.73760e-7',
        '1.77768e-7',
        '2.30467e-7',
        '1.03934e-7',
        '1.78872e-7',
      ] as const;
      const marketfi = new MarketFacilitationIndex();

      candles.forEach((candle, i) => {
        const result = marketfi.add(candle);

        expect(result?.toFixed(3)).toBe('0.000');
        expect(result?.toExponential(5)).toBe(expectations[i]);
      });

      expect(marketfi.isStable).toBe(true);
      expect(marketfi.getRequiredInputs()).toBe(1);
    });

    it('measures how much price range one unit of volume moved', () => {
      const marketfi = new MarketFacilitationIndex();

      expect(marketfi.add({close: 100, high: 110, low: 90, volume: 100})).toBe(0.2);
      expect(marketfi.add({close: 100, high: 105, low: 95, volume: 200})).toBe(0.05);
    });

    it('reads a candle nobody traded as zero facilitation instead of dividing by zero', () => {
      /*
       * The Tulip reference divides regardless and would emit a non-finite value here; this implementation
       * deliberately reports zero facilitation for a volume-less candle.
       */
      const marketfi = new MarketFacilitationIndex();

      expect(marketfi.add({close: 100, high: 101, low: 99, volume: 0})).toBe(0);
      expect(marketfi.isStable).toBe(true);
      expect(marketfi.getResultOrThrow()).toBe(0);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const marketfi = new MarketFacilitationIndex();

      marketfi.add({close: 100, high: 105, low: 95, volume: 200});

      const originalValue = {close: 101, high: 110, low: 90, volume: 100} as const;
      const replacedValue = {close: 99, high: 104, low: 96, volume: 400} as const;

      const originalResult = marketfi.add(originalValue);

      expect(originalResult).toBe(0.2);

      const replacedResult = marketfi.replace(replacedValue);

      expect(replacedResult).toBe(0.02);

      const restoredResult = marketfi.replace(originalValue);

      expect(restoredResult).toBe(0.2);
    });
  });
});

testIndicatorContract({
  create: () => new MarketFacilitationIndex(),
  divergentInput: {close: 90, high: 95, low: 82, volume: 99_000_000},
  inputs: [
    {close: 81.59, high: 82.15, low: 81.29, volume: 5_653_100},
    {close: 81.06, high: 81.89, low: 80.64, volume: 6_447_400},
    {close: 82.87, high: 83.03, low: 81.31, volume: 7_690_900},
  ],
});
