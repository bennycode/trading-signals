import {TradingSignal} from '../../base/index.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {PGO} from './PGO.js';

describe('PGO', () => {
  /*
   * There is no Tulip Indicators entry for the Pretty Good Oscillator, and pandas-ta's exact numbers cannot
   * be reproduced by a streaming implementation on a short series: pandas-ta computes Wilder's smoothing via
   * pandas' `ewm(adjust=True)`, which re-weights the entire history on every bar, and seeds its EMA with the
   * mean of the first `interval` values, while the moving averages in this library seed from their first
   * input and smooth recursively. Both converge on long series but disagree on any short worksheet. The
   * expectations below are therefore derived by hand from the published formula — close minus its Simple
   * Moving Average, divided by an EMA of the Wilder-smoothed Average True Range — with candles shaped so
   * that every intermediate value is an exact binary fraction, which allows exact assertions.
   *
   * Formula sources:
   * @see https://www.fmlabs.com/reference/default.htm?url=PGO.htm
   * @see https://github.com/twopirllc/pandas-ta (pandas_ta/momentum/pgo.py)
   *
   * Worksheet (interval 3): every candle keeps a true range of exactly 4, so the Wilder-smoothed ATR reads 4
   * from bar 3 on and its EMA stays 4 once seeded — stable on bar 5 (2 × 3 − 1 candles).
   *
   * | Bar | Close | High | Low | TR | ATR | EMA(ATR) | SMA(3)      | PGO                   |
   * | --- | ----- | ---- | --- | -- | --- | -------- | ----------- | --------------------- |
   * | 1   | 12    | 14   | 10  | 4  | —   | —        | —           | —                     |
   * | 2   | 15    | 16   | 12  | 4  | —   | —        | —           | —                     |
   * | 3   | 18    | 19   | 15  | 4  | 4   | 4        | 45 / 3 = 15 | — (EMA warming up)    |
   * | 4   | 15    | 18   | 14  | 4  | 4   | 4        | 48 / 3 = 16 | — (EMA warming up)    |
   * | 5   | 18    | 19   | 15  | 4  | 4   | 4        | 51 / 3 = 17 | (18 − 17) / 4 = 0.25  |
   * | 6   | 15    | 18   | 14  | 4  | 4   | 4        | 48 / 3 = 16 | (15 − 16) / 4 = −0.25 |
   */
  const candles = [
    {close: 12, high: 14, low: 10},
    {close: 15, high: 16, low: 12},
    {close: 18, high: 19, low: 15},
    {close: 15, high: 18, low: 14},
    {close: 18, high: 19, low: 15},
    {close: 15, high: 18, low: 14},
  ] as const;

  describe('getResultOrThrow', () => {
    it('expresses the distance between the close and its moving average in units of smoothed true range', () => {
      const expectations = [0.25, -0.25] as const;
      const pgo = new PGO({interval: 3});
      const offset = pgo.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = pgo.add(candle);

        if (result !== null) {
          expect(result).toBe(expectations[i - offset]);
        }
      });

      expect(pgo.isStable).toBe(true);
    });

    it('yields the same reading for the same pattern at ten times the price', () => {
      const base = new PGO({interval: 3});
      const scaled = new PGO({interval: 3});

      candles.forEach(candle => {
        const baseResult = base.add(candle);
        const scaledResult = scaled.add({close: candle.close * 10, high: candle.high * 10, low: candle.low * 10});

        expect(scaledResult).toBe(baseResult);
      });

      expect(scaled.getResultOrThrow()).toBe(-0.25);
    });

    it('reads neutral when a dead market leaves no volatility to measure against', () => {
      const pgo = new PGO({interval: 3});
      const flatCandle = {close: 100, high: 100, low: 100} as const;

      for (let i = 0; i < 5; i++) {
        pgo.add(flatCandle);
      }

      expect(pgo.getResultOrThrow()).toBe(0);
      expect(pgo.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('getRequiredInputs', () => {
    it('needs 27 candles by default because the two smoothing stages fill up in sequence', () => {
      const pgo = new PGO();

      expect(pgo.getRequiredInputs()).toBe(27);
    });

    it('needs one candle less than twice the configured interval', () => {
      const pgo = new PGO({interval: 3});

      expect(pgo.getRequiredInputs()).toBe(5);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const pgo = new PGO({interval: 3});

      for (const candle of candles.slice(0, 5)) {
        pgo.add(candle);
      }

      /*
       * The replacement candle keeps the true range at 4 (high − low = 4, high − previous close = 4) and
       * shifts the window closes to 15, 18, 21: SMA = 54 / 3 = 18 → PGO = (21 − 18) / 4 = 0.75.
       */
      const originalValue = candles[5];
      const replacedValue = {close: 21, high: 22, low: 18} as const;

      const originalResult = pgo.add(originalValue);

      expect(originalResult).toBe(-0.25);

      const replacedResult = pgo.replace(replacedValue);

      expect(replacedResult).toBe(0.75);

      const restoredResult = pgo.replace(originalValue);

      expect(restoredResult).toBe(-0.25);
    });
  });

  describe('getSignal', () => {
    const quietCandle = {close: 100, high: 102, low: 98} as const;

    it('returns UNKNOWN when there is no result', () => {
      const pgo = new PGO({interval: 3});
      const signal = pgo.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });

    it('signals a long breakout when the close runs more than three smoothed true ranges above its average', () => {
      const pgo = new PGO({interval: 3});

      for (let i = 0; i < 5; i++) {
        pgo.add(quietCandle);
      }

      expect(pgo.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      /*
       * The breakout candle lifts the true range from 4 to 64: ATR = 4 + (64 − 4) / 3 = 24, its EMA =
       * (24 + 4) / 2 = 14, SMA = (100 + 100 + 164) / 3 = 364/3 → PGO = (164 − 364/3) / 14 = 64/21 ≈ 3.05.
       */
      pgo.add({close: 164, high: 164, low: 100});

      expect(pgo.getResultOrThrow().toFixed(2)).toBe('3.05');

      const signal = pgo.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('signals a short breakout when the close falls more than three smoothed true ranges below its average', () => {
      const pgo = new PGO({interval: 3});

      for (let i = 0; i < 5; i++) {
        pgo.add(quietCandle);
      }

      expect(pgo.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      /*
       * Mirror of the long breakout: the true range jumps to 64, the denominator to 14, and the window
       * closes average 236/3 → PGO = (36 − 236/3) / 14 = −64/21 ≈ −3.05.
       */
      pgo.add({close: 36, high: 100, low: 36});

      expect(pgo.getResultOrThrow().toFixed(2)).toBe('-3.05');

      const signal = pgo.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns SIDEWAYS while the close stays within the breakout territory', () => {
      const pgo = new PGO({interval: 3});

      for (const candle of candles) {
        pgo.add(candle);
      }

      expect(pgo.getResultOrThrow()).toBe(-0.25);

      const signal = pgo.getSignal();

      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
      expect(signal.hasChanged).toBe(false);
    });

    it('turns bullish exactly at the overbought threshold', () => {
      const defaults = new PGO({interval: 3});
      const custom = new PGO({interval: 3, signalThresholds: {overbought: 0.5, oversold: -0.5}});
      const calmCandle = {close: 15, high: 17, low: 13} as const;
      // Keeps the true range at 4 while lifting the close 2 points above the window average: PGO = 2 / 4 = 0.5
      const pushCandle = {close: 18, high: 19, low: 15} as const;

      for (const pgo of [defaults, custom]) {
        for (let i = 0; i < 4; i++) {
          pgo.add(calmCandle);
        }

        pgo.add(pushCandle);

        expect(pgo.getResultOrThrow()).toBe(0.5);
      }

      expect(custom.getSignal().state).toBe(TradingSignal.BULLISH);
      expect(defaults.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('turns bearish exactly at the oversold threshold', () => {
      const defaults = new PGO({interval: 3});
      const custom = new PGO({interval: 3, signalThresholds: {overbought: 0.5, oversold: -0.5}});
      const calmCandle = {close: 15, high: 17, low: 13} as const;
      // Keeps the true range at 4 while dropping the close 2 points below the window average: PGO = −2 / 4 = −0.5
      const dropCandle = {close: 12, high: 16, low: 12} as const;

      for (const pgo of [defaults, custom]) {
        for (let i = 0; i < 4; i++) {
          pgo.add(calmCandle);
        }

        pgo.add(dropCandle);

        expect(pgo.getResultOrThrow()).toBe(-0.5);
      }

      expect(custom.getSignal().state).toBe(TradingSignal.BEARISH);
      expect(defaults.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });
});

testIndicatorContract({
  create: () => new PGO({interval: 3}),
  divergentInput: {close: 1_000, high: 1_000, low: 1_000},
  inputs: [
    {close: 12, high: 14, low: 10},
    {close: 15, high: 16, low: 12},
    {close: 18, high: 19, low: 15},
    {close: 15, high: 18, low: 14},
    {close: 18, high: 19, low: 15},
    {close: 15, high: 18, low: 14},
  ],
});
