import {ADOSC} from './ADOSC.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../base/index.js';

describe('ADOSC', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L28-L33
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
    '1900759.847',
    '399262.040',
    '-241806.815',
    '757828.287',
    '1068830.285',
    '328526.246',
    '1466909.296',
    '3475262.287',
    '4653474.793',
    '5067839.265',
    '3474675.616',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const adosc = new ADOSC({fastPeriod: 2, slowPeriod: 5});

      adosc.updates(candles, false);

      const originalValue = {close: 89.5, high: 90.0, low: 88.0, volume: 5_000_000} as const;
      const replacedValue = {close: 82.5, high: 84.0, low: 82.0, volume: 5_000_000} as const;

      const originalResult = adosc.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('3181822.45');

      const replacedResult = adosc.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('1515155.78');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = adosc.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const adosc = new ADOSC({fastPeriod: 2, slowPeriod: 5});
      const offset = adosc.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = adosc.add(candle);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(adosc.isStable).toBe(true);
      expect(adosc.getRequiredInputs()).toBe(5);
    });

    it('throws an error when there is not enough input data', () => {
      const adosc = new ADOSC();

      try {
        adosc.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const adosc = new ADOSC();

      expect(adosc.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when money flows into the security', () => {
      const adosc = new ADOSC({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 6; i++) {
        adosc.add({close: 12 + i, high: 12 + i, low: 10 + i, volume: 1_000_000});
      }

      expect(adosc.getResultOrThrow()).toBeGreaterThan(0);
      expect(adosc.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when money flows out of the security', () => {
      const adosc = new ADOSC({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 6; i++) {
        adosc.add({close: 50 - i, high: 52 - i, low: 50 - i, volume: 1_000_000});
      }

      expect(adosc.getResultOrThrow()).toBeLessThan(0);
      expect(adosc.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when no money flows in either direction', () => {
      const adosc = new ADOSC({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 6; i++) {
        adosc.add({close: 50, high: 51, low: 49, volume: 1_000_000});
      }

      expect(adosc.getResultOrThrow()).toBe(0);
      expect(adosc.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });
});
