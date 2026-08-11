import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {NVI} from './NVI.js';

describe('NVI', () => {
  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      /*
       * Test data verified with:
       * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L303-L306
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
      const expectations = [
        '1000.000',
        '1000.000',
        '1000.000',
        '1001.569',
        '1001.569',
        '996.058',
        '996.058',
        '996.058',
        '996.058',
        '993.820',
        '993.820',
        '1005.556',
        '1009.623',
        '1009.623',
        '1004.101',
      ] as const;
      const nvi = new NVI();

      candles.forEach((candle, i) => {
        const result = nvi.add(candle);

        expect(result?.toFixed(3)).toBe(expectations[i]);
      });

      expect(nvi.isStable).toBe(true);
      expect(nvi.getRequiredInputs()).toBe(1);
    });

    it('starts the index at 1000 on the very first candle', () => {
      const nvi = new NVI();

      expect(nvi.add({close: 81.59, high: 82.15, low: 81.29, volume: 5_653_100})).toBe(1_000);
    });

    it('keeps the index flat when volume is unchanged', () => {
      const nvi = new NVI();

      nvi.add({close: 100, high: 100, low: 100, volume: 5_000});
      nvi.add({close: 200, high: 200, low: 200, volume: 5_000});

      expect(nvi.getResultOrThrow()).toBe(1_000);
    });
  });

  describe('replace', () => {
    /** Keeps the tests focused on close and volume by faking a candle that has no intra-bar movement. */
    const fakeFlatCandle = (close: number, volume: number) => ({close, high: close, low: close, volume}) as const;

    it('rolls back the accumulation when the replacement no longer shows falling volume', () => {
      const nvi = new NVI();

      nvi.add(fakeFlatCandle(100, 10_000));
      nvi.add(fakeFlatCandle(112.5, 8_000));

      const originalValue = fakeFlatCandle(126.5625, 6_000);
      const replacedValue = fakeFlatCandle(126.5625, 9_000);

      const originalResult = nvi.add(originalValue);

      expect(originalResult).toBe(1_265.625);

      const replacedResult = nvi.replace(replacedValue);

      expect(replacedResult).toBe(1_125);

      const restoredResult = nvi.replace(originalValue);

      expect(restoredResult).toBe(1_265.625);
    });

    it('applies the accumulation when only the replacement shows falling volume', () => {
      const nvi = new NVI();

      nvi.add(fakeFlatCandle(100, 10_000));
      nvi.add(fakeFlatCandle(112.5, 8_000));

      const originalValue = fakeFlatCandle(126.5625, 9_000);
      const replacedValue = fakeFlatCandle(126.5625, 6_000);

      const originalResult = nvi.add(originalValue);

      expect(originalResult).toBe(1_125);

      const replacedResult = nvi.replace(replacedValue);

      expect(replacedResult).toBe(1_265.625);

      const restoredResult = nvi.replace(originalValue);

      expect(restoredResult).toBe(1_125);
    });
  });
});

testIndicatorContract({
  create: () => new NVI(),
  divergentInput: {close: 500, high: 500, low: 500, volume: 1_000},
  inputs: [
    {close: 81.59, high: 82.15, low: 81.29, volume: 5_653_100},
    {close: 81.06, high: 81.89, low: 80.64, volume: 6_447_400},
    {close: 82.87, high: 83.03, low: 81.31, volume: 7_690_900},
    {close: 83.0, high: 83.3, low: 82.65, volume: 3_831_400},
  ],
});
