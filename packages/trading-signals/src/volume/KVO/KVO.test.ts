import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {KVO} from './KVO.js';
import {TradingSignal} from '../../base/index.js';

describe('KVO', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L211-L216
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
    '0.000',
    '80292599.241',
    '121572746.633',
    '117732669.219',
    '-5942017.641',
    '-71041561.798',
    '34448275.848',
    '84097903.128',
    '-38366427.074',
    '40313036.023',
    '56681039.569',
    '52208374.664',
    '138983547.947',
    '-68009735.443',
  ] as const;

  describe('constructor', () => {
    it('defaults to the 34/55 intervals proposed by Stephen Klinger', () => {
      const kvoDefault = new KVO();
      const kvoExplicit = new KVO(34, 55);

      expect(kvoDefault.shortInterval).toBe(34);
      expect(kvoDefault.longInterval).toBe(55);

      for (const candle of candles) {
        kvoDefault.add(candle);
        kvoExplicit.add(candle);
      }

      expect(kvoDefault.getResultOrThrow()).toBe(kvoExplicit.getResultOrThrow());
      expect(kvoDefault.getResultOrThrow().toFixed(3)).toBe('50151081.102');
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const kvo = new KVO(2, 5);

      kvo.updates(candles, false);

      /*
       * The original candle flips Klinger's swing up while the replacement keeps it falling,
       * so the replacement has to roll back the flip and the restarted cumulative measurement.
       */
      const originalValue = {close: 88.5, high: 89.0, low: 87.9, volume: 6_000_000} as const;
      const replacedValue = {close: 86.2, high: 87.1, low: 86.0, volume: 6_000_000} as const;

      const originalResult = kvo.add(originalValue);

      expect(originalResult?.toFixed(3)).toBe('-71560261.159');

      const replacedResult = kvo.replace(replacedValue);

      expect(replacedResult?.toFixed(3)).toBe('-138343963.888');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = kvo.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const kvo = new KVO(2, 5);
      const offset = kvo.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = kvo.add(candle);

        if (result !== null) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(kvo.isStable).toBe(true);
      expect(kvo.getRequiredInputs()).toBe(2);
    });

    it('stays finite when the market has never traded a range', () => {
      const kvo = new KVO(2, 5);
      const flatCandle = {close: 100, high: 100, low: 100, volume: 5_000} as const;

      kvo.add(flatCandle);

      expect(kvo.add(flatCandle)).toBe(0);
      expect(kvo.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      kvo.add({close: 105, high: 106, low: 99, volume: 6_000});

      expect(kvo.getResultOrThrow()).toBe(200_000);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const kvo = new KVO();

      expect(kvo.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when volume flows into the security', () => {
      const kvo = new KVO(2, 5);

      for (let i = 0; i < 6; i++) {
        kvo.add({close: 12 + i, high: 12 + i, low: 10 + i, volume: 1_000_000});
      }

      expect(kvo.getResultOrThrow()).toBeGreaterThan(0);
      expect(kvo.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when volume flows out of the security', () => {
      const kvo = new KVO(2, 5);

      for (let i = 0; i < 6; i++) {
        kvo.add({close: 50 - i, high: 52 - i, low: 50 - i, volume: 1_000_000});
      }

      expect(kvo.getResultOrThrow()).toBeLessThan(0);
      expect(kvo.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when two identical candles leave no dominant money flow', () => {
      const kvo = new KVO(2, 5);

      for (let i = 0; i < 2; i++) {
        kvo.add({close: 50, high: 51, low: 49, volume: 1_000_000});
      }

      expect(kvo.getResultOrThrow()).toBe(0);
      expect(kvo.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });
});

testIndicatorContract({
  create: () => new KVO(2, 5),
  divergentInput: {close: 90, high: 82, low: 95, volume: 99_000_000},
  inputs: [
    {close: 81.59, high: 82.15, low: 81.29, volume: 5_653_100},
    {close: 81.06, high: 81.89, low: 80.64, volume: 6_447_400},
    {close: 82.87, high: 83.03, low: 81.31, volume: 7_690_900},
    {close: 83.0, high: 83.3, low: 82.65, volume: 3_831_400},
    {close: 83.61, high: 83.85, low: 83.07, volume: 4_455_100},
    {close: 83.15, high: 83.9, low: 83.11, volume: 3_798_000},
  ],
});
