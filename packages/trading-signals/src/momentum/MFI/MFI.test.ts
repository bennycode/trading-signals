import {MFI} from './MFI.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../base/index.js';

describe('MFI', () => {
  /*
   * Test data verified with:
   * https://tulipindicators.org/mfi
   * @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L272-L277
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
    '61.172',
    '67.308',
    '62.796',
    '64.661',
    '45.238',
    '67.841',
    '85.578',
    '85.963',
    '87.504',
    '84.647',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const mfi = new MFI(5);

      mfi.updates(candles, false);

      const originalValue = {close: 89.0, high: 90.0, low: 88.0, volume: 5_000_000} as const;
      const replacedValue = {close: 83.0, high: 84.0, low: 82.0, volume: 5_000_000} as const;

      const originalResult = mfi.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('83.84');

      const replacedResult = mfi.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('67.50');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = mfi.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const mfi = new MFI(interval);
      const offset = mfi.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = mfi.add(candle);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(mfi.isStable).toBe(true);
      expect(mfi.getRequiredInputs()).toBe(interval + 1);
    });

    it('returns a neutral index when no money flows in either direction', () => {
      const mfi = new MFI(5);
      const flatCandle = {close: 50, high: 51, low: 49, volume: 1_000_000} as const;

      for (let i = 0; i < 6; i++) {
        mfi.add(flatCandle);
      }

      expect(mfi.getResultOrThrow()).toBe(50);
    });

    it('throws an error when there is not enough input data', () => {
      const mfi = new MFI(5);

      try {
        mfi.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const mfi = new MFI(5);

      expect(mfi.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when the MFI indicates an overbought market', () => {
      const mfi = new MFI(5);

      mfi.updates(candles, false);

      expect(mfi.getResultOrThrow()).toBeGreaterThanOrEqual(80);
      expect(mfi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the MFI indicates an oversold market', () => {
      const mfi = new MFI(5);

      for (let i = 0; i < 6; i++) {
        const price = 100 - i;
        mfi.add({close: price, high: price + 1, low: price - 1, volume: 1_000_000});
      }

      expect(mfi.getResultOrThrow()).toBe(0);
      expect(mfi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the MFI is between the oversold and overbought thresholds', () => {
      const mfi = new MFI(5);
      const flatCandle = {close: 50, high: 51, low: 49, volume: 1_000_000} as const;

      for (let i = 0; i < 6; i++) {
        mfi.add(flatCandle);
      }

      expect(mfi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });
});
