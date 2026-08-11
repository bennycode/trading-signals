import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {TradingSignal} from '../../base/Indicator.js';
import {PremierStochastic} from './PremierStochastic.js';

describe('PremierStochastic', () => {
  /*
   * Candle series taken from the Tulip Indicators sample data used across this repository:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt
   * Tulip ships no premier stochastic, so the expectations were computed from Leibfarth's published
   * formula (TASC August 2008) with two independent implementations (streaming and batch) that agree
   * on every digit.
   */
  const highs = [
    82.15, 81.89, 83.03, 83.3, 83.85, 83.9, 83.33, 84.3, 84.84, 85.0, 85.9, 86.58, 86.98, 88.0, 87.87,
  ] as const;
  const lows = [
    81.29, 80.64, 81.31, 82.65, 83.07, 83.11, 82.49, 82.3, 84.15, 84.11, 84.03, 85.39, 85.76, 87.17, 87.01,
  ] as const;
  const closes = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;

  describe('constructor', () => {
    it('defaults to an 8-candle range with the square-root smoothing from the original article', () => {
      const pso = new PremierStochastic();

      expect(pso.stochInterval).toBe(8);
      expect(pso.smoothInterval).toBe(3);
      expect(pso.getRequiredInputs()).toBe(12);
    });

    it('derives the smoothing length from a custom stochastic interval', () => {
      const pso = new PremierStochastic({stochInterval: 14});

      expect(pso.smoothInterval).toBe(4);
      expect(pso.getRequiredInputs()).toBe(20);
    });

    it('accepts an explicit smoothing length', () => {
      const pso = new PremierStochastic({smoothInterval: 5});

      expect(pso.stochInterval).toBe(8);
      expect(pso.smoothInterval).toBe(5);
      expect(pso.getRequiredInputs()).toBe(16);
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the premier stochastic with the default configuration', () => {
      const expectations = ['0.9672', '0.9744', '0.9774', '0.9738'] as const;
      const pso = new PremierStochastic();
      const offset = pso.getRequiredInputs() - 1;

      highs.forEach((high, i) => {
        const result = pso.add({close: closes[i], high, low: lows[i]});

        if (result !== null) {
          expect(result.toFixed(4)).toBe(expectations[i - offset]);
        }
      });

      expect(pso.isStable).toBe(true);
    });

    it('matches a hand-derived worksheet with exact fractions', () => {
      /*
       * A 2-candle range keeps the raw stochastic obvious: the closes position at 100, 0, 50 and 100
       * percent of their window, centering to 5, -5, 0 and 5. The first EMA pass (weight 2/3) yields
       * 5, -5/3, -5/9 and 85/27; the second pass, seeded once the first is warmed up, yields -5/3,
       * -25/27 and 145/81. The normalization equals tanh of half its input, so the two emitted
       * results are tanh(-25/54) ≈ -0.4325 and tanh(145/162) ≈ 0.7139.
       */
      const candles = [
        {close: 10, high: 10, low: 0},
        {close: 10, high: 10, low: 0},
        {close: 0, high: 10, low: 0},
        {close: 5, high: 10, low: 0},
        {close: 10, high: 10, low: 0},
      ] as const;
      const expectations = ['-0.4325', '0.7139'] as const;
      const pso = new PremierStochastic({smoothInterval: 2, stochInterval: 2});
      const offset = pso.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = pso.add(candle);

        if (result !== null) {
          expect(result.toFixed(4)).toBe(expectations[i - offset]);
        }
      });

      expect(pso.isStable).toBe(true);
    });

    it('saturates just inside the bounds when the close pins its range', () => {
      /*
       * A smoothing length of 1 turns both EMA passes into pass-throughs, so a close pinned to the
       * top of its range maps straight to (e^5 - 1) / (e^5 + 1) — the saturation ceiling of ~0.9866
       * — and a pinned bottom to its negative.
       */
      const pso = new PremierStochastic({smoothInterval: 1, stochInterval: 2});

      pso.add({close: 10, high: 10, low: 0});

      expect(pso.add({close: 10, high: 10, low: 0})?.toFixed(4)).toBe('0.9866');
      expect(pso.add({close: 0, high: 10, low: 0})?.toFixed(4)).toBe('-0.9866');
    });

    it('reads a window without any price range as the neutral middle', () => {
      const pso = new PremierStochastic({smoothInterval: 1, stochInterval: 2});

      for (let i = 0; i < 4; i++) {
        pso.add({close: 100, high: 100, low: 100});
      }

      expect(pso.getResultOrThrow()).toBe(0);
    });

    it('stays strictly inside the ±1 bounds across violent price swings', () => {
      const wildCloses = [
        1, 1000, 2, 500, 0.5, 800, 3, 900, 1, 700, 2, 600, 4, 999, 0.1, 1200, 0.01, 5000, 0.5, 3000,
      ] as const;
      const pso = new PremierStochastic();
      const results: number[] = [];

      for (const close of wildCloses) {
        const result = pso.add({close, high: close * 1.05, low: close * 0.95});

        if (result !== null) {
          results.push(result);
        }
      }

      expect(results).toHaveLength(9);

      for (const result of results) {
        expect(Math.abs(result)).toBeLessThan(1);
      }
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const pso = new PremierStochastic();

      highs.slice(0, 14).forEach((high, i) => {
        pso.add({close: closes[i], high, low: lows[i]});
      });

      const latestValue = {close: 87.29, high: 87.87, low: 87.01} as const;
      const latestResult = '0.9738';

      pso.add(latestValue);

      expect(pso.getResultOrThrow().toFixed(4)).toBe(latestResult);

      const someOtherValue = {close: 84.05, high: 88.5, low: 84} as const;
      const otherResult = '0.8896';

      pso.replace(someOtherValue);

      expect(pso.getResultOrThrow().toFixed(4)).toBe(otherResult);

      pso.replace(latestValue);

      expect(pso.getResultOrThrow().toFixed(4)).toBe(latestResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const pso = new PremierStochastic();

      expect(pso.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when momentum sits above the zero line', () => {
      const pso = new PremierStochastic({smoothInterval: 1, stochInterval: 2});

      pso.add({close: 10, high: 10, low: 9});
      pso.add({close: 11, high: 11, low: 10});

      expect(pso.getResultOrThrow()).toBeGreaterThan(0);
      expect(pso.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BULLISH,
      });
    });

    it('returns BEARISH when momentum sits below the zero line', () => {
      const pso = new PremierStochastic({smoothInterval: 1, stochInterval: 2});

      pso.add({close: 10, high: 11, low: 10});
      pso.add({close: 9, high: 10, low: 9});

      expect(pso.getResultOrThrow()).toBeLessThan(0);
      expect(pso.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });

    it('returns SIDEWAYS when a mid-range close keeps the oscillator at exactly zero', () => {
      const pso = new PremierStochastic({smoothInterval: 1, stochInterval: 2});

      pso.add({close: 5, high: 10, low: 0});
      pso.add({close: 5, high: 10, low: 0});

      expect(pso.getResultOrThrow()).toBe(0);
      expect(pso.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.SIDEWAYS,
      });
    });

    it('only reports a change when the zero line is crossed', () => {
      const pso = new PremierStochastic({smoothInterval: 1, stochInterval: 2});

      pso.add({close: 10, high: 10, low: 0});
      pso.add({close: 10, high: 10, low: 0});

      expect(pso.getSignal().state).toBe(TradingSignal.BULLISH);

      pso.add({close: 0, high: 10, low: 0});

      expect(pso.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });

      pso.add({close: 0, high: 10, low: 0});

      expect(pso.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BEARISH,
      });
    });
  });
});

/*
 * The divergent candle widens the window's range upward while closing at its bottom, which flips the
 * stochastic reading and with it the smoothing state of both EMA passes.
 */
testIndicatorContract({
  create: () => new PremierStochastic(),
  divergentInput: {close: 84.05, high: 88.5, low: 84},
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
