import {TradingSignal} from '../../base/index.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {ProjectionOscillator} from './ProjectionOscillator.js';

describe('ProjectionOscillator', () => {
  /*
   * There is no Tulip Indicators entry and no reliable public fixture for the Projection Oscillator, so the
   * expectations below are derived by hand from the original formula by Mel Widner, published in "Technical
   * Analysis of Stocks & Commodities" (July 1995). The candles are chosen so that every intermediate value is
   * an exact binary fraction, which allows exact assertions.
   *
   * @see https://www.fmlabs.com/reference/default.htm?url=ProjectionOscillator.htm
   *
   * Interval 4, x = 0..3: Σx = 6, Σx² = 14, so the least-squares slope over the closes is
   * m = (4·Σxy − 6·Σy) / (4·14 − 6²) = (4·Σxy − 6·Σy) / 20.
   *
   * Window 1 (candles 1-4), closes 10, 11, 12, 13: Σy = 46, Σxy = 74 → m = (296 − 276) / 20 = 1.
   * Every bar is projected forward to the current bar by m × (remaining bars):
   *
   * | Bar | High | Low | Projection | Projected high | Projected low |
   * | --- | ---- | --- | ---------- | -------------- | ------------- |
   * | 1   | 11   | 9   | +3         | 14             | 12            |
   * | 2   | 12   | 10  | +2         | 14             | 12            |
   * | 3   | 13   | 8   | +1         | 14             | 9             |
   * | 4   | 14   | 11  | ±0         | 14             | 11            |
   *
   * Upper band = 14, lower band = 9 → PO = 100 × (13 − 9) / (14 − 9) = 80.
   *
   * Window 2 (candles 2-5), closes 11, 12, 13, 4: Σy = 40, Σxy = 50 → m = (200 − 240) / 20 = −2.
   *
   * | Bar | High | Low | Projection | Projected high | Projected low |
   * | --- | ---- | --- | ---------- | -------------- | ------------- |
   * | 2   | 12   | 10  | −6         | 6              | 4             |
   * | 3   | 13   | 8   | −4         | 9              | 4             |
   * | 4   | 14   | 11  | −2         | 12             | 9             |
   * | 5   | 13   | 3   | ±0         | 13             | 3             |
   *
   * Upper band = 13, lower band = 3 → PO = 100 × (4 − 3) / (13 − 3) = 10.
   */
  const uptrendCandles = [
    {close: 10, high: 11, low: 9},
    {close: 11, high: 12, low: 10},
    {close: 12, high: 13, low: 8},
    {close: 13, high: 14, low: 11},
  ] as const;
  const crashCandle = {close: 4, high: 13, low: 3} as const;
  const candles = [...uptrendCandles, crashCandle] as const;

  describe('getResultOrThrow', () => {
    it('locates the close within the projection bands', () => {
      const expectations = [80, 10] as const;
      const po = new ProjectionOscillator({interval: 4});
      const offset = po.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = po.add(candle);

        if (result !== null) {
          expect(result).toBe(expectations[i - offset]);
        }
      });

      expect(po.isStable).toBe(true);
    });

    it('reads 100 when the close is pinned to the upper projection band', () => {
      /*
       * When every candle of a steady uptrend closes at its high, all projected highs land exactly on the
       * latest close, so the close sits on the upper band itself.
       */
      const po = new ProjectionOscillator({interval: 4});
      const closes = [10, 12, 14, 16] as const;

      for (const close of closes) {
        po.add({close, high: close, low: close - 2});
      }

      expect(po.getResultOrThrow()).toBe(100);
    });

    it('reads 0 when the close is pinned to the lower projection band', () => {
      // Mirror case: closing at the low of every bar puts the close on the lower band itself
      const po = new ProjectionOscillator({interval: 4});
      const closes = [10, 12, 14, 16] as const;

      for (const close of closes) {
        po.add({close, high: close + 2, low: close});
      }

      expect(po.getResultOrThrow()).toBe(0);
    });

    it('reads neutral in a completely flat market', () => {
      const po = new ProjectionOscillator({interval: 4});
      const flatCandle = {close: 10, high: 10, low: 10} as const;

      for (let i = 0; i < 4; i++) {
        po.add(flatCandle);
      }

      expect(po.getResultOrThrow()).toBe(50);
      expect(po.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('getRequiredInputs', () => {
    it('measures 14 candles by default', () => {
      const po = new ProjectionOscillator();

      expect(po.getRequiredInputs()).toBe(14);
    });

    it('matches the configured interval', () => {
      const po = new ProjectionOscillator({interval: 4});

      expect(po.getRequiredInputs()).toBe(4);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const po = new ProjectionOscillator({interval: 4});

      for (const candle of uptrendCandles) {
        po.add(candle);
      }

      /*
       * Replacement window closes 11, 12, 13, 14: m = (4·80 − 6·50) / 20 = 1; projected highs all 15,
       * projected lows 13, 10, 12, 12 → PO = 100 × (14 − 10) / (15 − 10) = 80.
       */
      const originalValue = crashCandle;
      const replacedValue = {close: 14, high: 15, low: 12} as const;

      const originalResult = po.add(originalValue);

      expect(originalResult).toBe(10);

      const replacedResult = po.replace(replacedValue);

      expect(replacedResult).toBe(80);

      const restoredResult = po.replace(originalValue);

      expect(restoredResult).toBe(10);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const po = new ProjectionOscillator({interval: 4});
      const signal = po.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });

    it('returns BULLISH when the close presses against the upper projection band', () => {
      const po = new ProjectionOscillator({interval: 4});

      for (const candle of uptrendCandles) {
        po.add(candle);
      }

      expect(po.getResultOrThrow()).toBe(80);

      const signal = po.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns BEARISH when the close falls to the lower projection band', () => {
      const po = new ProjectionOscillator({interval: 4});

      for (const candle of candles) {
        po.add(candle);
      }

      expect(po.getResultOrThrow()).toBe(10);

      const signal = po.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns SIDEWAYS while a steady trend keeps the close mid-channel', () => {
      /*
       * The bands ride the regression trend, so a steady climb with mid-bar closes stays neutral instead of
       * registering as overbought.
       */
      const trendCandles = [
        {close: 10, high: 11, low: 9},
        {close: 12, high: 13, low: 11},
        {close: 14, high: 15, low: 13},
        {close: 16, high: 17, low: 15},
        {close: 18, high: 19, low: 17},
      ] as const;
      const po = new ProjectionOscillator({interval: 4});

      for (const candle of trendCandles) {
        po.add(candle);
      }

      expect(po.getResultOrThrow()).toBe(50);

      const signal = po.getSignal();

      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
      expect(signal.hasChanged).toBe(false);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const strict = new ProjectionOscillator({interval: 4, signalThresholds: {overbought: 90, oversold: 10}});
      const loose = new ProjectionOscillator({interval: 4, signalThresholds: {oversold: 5}});

      for (const candle of uptrendCandles) {
        strict.add(candle);
      }

      expect(strict.getResultOrThrow()).toBe(80);
      expect(strict.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      for (const candle of candles) {
        loose.add(candle);
      }

      expect(loose.getResultOrThrow()).toBe(10);
      expect(loose.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });
});

testIndicatorContract({
  create: () => new ProjectionOscillator({interval: 4}),
  divergentInput: {close: 1_000, high: 1_000, low: 1_000},
  inputs: [
    {close: 10, high: 11, low: 9},
    {close: 11, high: 12, low: 10},
    {close: 12, high: 13, low: 8},
    {close: 13, high: 14, low: 11},
    {close: 4, high: 13, low: 3},
  ],
});
