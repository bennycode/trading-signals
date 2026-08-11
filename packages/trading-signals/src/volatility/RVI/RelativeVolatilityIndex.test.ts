import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {RelativeVolatilityIndex} from './RelativeVolatilityIndex.js';
import {TradingSignal} from '../../base/index.js';

describe('RelativeVolatilityIndex', () => {
  /*
   * Hand-derived worksheet for Donald Dorsey's RVI (Technical Analysis of Stocks & Commodities,
   * June 1993, refined 1995) with a 3-close deviation window and 3-bar Wilder smoothing:
   * https://www.tradingview.com/support/solutions/43000594684-relative-volatility-index/
   *
   * "σ" is the population standard deviation of the window. A rising close assigns σ to "U",
   * a falling close assigns σ to "D", an unchanged close assigns it to neither (bar 7 — both
   * averages decay by the same factor, so the reading stays put). Both averages seed with the
   * plain average of their first 3 inputs and continue as avg + (x - avg) / 3.
   *
   * bar | close | window     |      σ |      U |      D |   avgU |   avgD | RVI = 100 × avgU / (avgU + avgD)
   *   1 |    10 | [10]       |      - |      - |      - |      - |      - |     -
   *   2 |    12 | [10,12]    |      - |      - |      - |      - |      - |     -
   *   3 |    11 | [10,12,11] | 0.8165 | 0      | 0.8165 |      - |      - |     -
   *   4 |    13 | [12,11,13] | 0.8165 | 0.8165 | 0      |      - |      - |     -
   *   5 |    14 | [11,13,14] | 1.2472 | 1.2472 | 0      | 0.6879 | 0.2722 | 71.65
   *   6 |    12 | [13,14,12] | 0.8165 | 0      | 0.8165 | 0.4586 | 0.4536 | 50.27
   *   7 |    12 | [14,12,12] | 0.9428 | 0      | 0      | 0.3057 | 0.3024 | 50.27
   *   8 |    15 | [12,12,15] | 1.4142 | 1.4142 | 0      | 0.6752 | 0.2016 | 77.01
   */
  const prices = [10, 12, 11, 13, 14, 12, 12, 15] as const;
  const expectations = ['71.65', '50.27', '50.27', '77.01'] as const;

  describe('getResultOrThrow', () => {
    it('matches the hand-derived Dorsey worksheet', () => {
      const rvi = new RelativeVolatilityIndex({interval: 3, stddevInterval: 3});
      const offset = rvi.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = rvi.add(price);

        if (result) {
          expect(result.toFixed(2)).toBe(expectations[i - offset]);
        }
      });

      expect(rvi.isStable).toBe(true);
    });

    it('reads neutral when a dead market produces no volatility to attribute to either side', () => {
      const rvi = new RelativeVolatilityIndex({interval: 3, stddevInterval: 3});

      for (let i = 0; i < 6; i++) {
        rvi.add(100);
      }

      expect(rvi.getResultOrThrow()).toBe(50);
    });
  });

  describe('getRequiredInputs', () => {
    it('spans the deviation window plus the smoothing warm-up', () => {
      expect(new RelativeVolatilityIndex().getRequiredInputs()).toBe(23);
      expect(new RelativeVolatilityIndex({interval: 3, stddevInterval: 3}).getRequiredInputs()).toBe(5);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const rvi = new RelativeVolatilityIndex({interval: 3, stddevInterval: 3});

      for (const price of prices) {
        rvi.add(price);
      }

      // Swinging the bar from an up-move to a down-move rolls back the deviation window and both smoothings
      const originalResult = rvi.add(16);

      expect(originalResult?.toFixed(2)).toBe('88.32');

      const replacedResult = rvi.replace(9);

      expect(replacedResult?.toFixed(2)).toBe('32.13');

      const restoredResult = rvi.replace(16);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const rvi = new RelativeVolatilityIndex({interval: 3, stddevInterval: 3});

      expect(rvi.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when all volatility builds on the upside', () => {
      const rvi = new RelativeVolatilityIndex({interval: 3, stddevInterval: 3});

      for (const price of [1, 2, 3, 4, 5] as const) {
        rvi.add(price);
      }

      expect(rvi.getResultOrThrow()).toBe(100);
      expect(rvi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when all volatility builds on the downside', () => {
      const rvi = new RelativeVolatilityIndex({interval: 3, stddevInterval: 3});

      for (const price of [9, 8, 7, 6, 5] as const) {
        rvi.add(price);
      }

      expect(rvi.getResultOrThrow()).toBe(0);
      expect(rvi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the volatility mix sits between the thresholds', () => {
      const rvi = new RelativeVolatilityIndex({interval: 3, stddevInterval: 3});

      for (const price of [10, 12, 11, 13, 14, 12] as const) {
        rvi.add(price);
      }

      expect(rvi.getResultOrThrow().toFixed(2)).toBe('50.27');
      expect(rvi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('treats a reading exactly on the overbought threshold as BULLISH', () => {
      const rvi = new RelativeVolatilityIndex({
        interval: 3,
        signalThresholds: {overbought: 100},
        stddevInterval: 3,
      });

      for (const price of [1, 2, 3, 4, 5] as const) {
        rvi.add(price);
      }

      expect(rvi.getResultOrThrow()).toBe(100);
      expect(rvi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('treats a reading exactly on the oversold threshold as BEARISH', () => {
      const rvi = new RelativeVolatilityIndex({
        interval: 3,
        signalThresholds: {oversold: 0},
        stddevInterval: 3,
      });

      for (const price of [9, 8, 7, 6, 5] as const) {
        rvi.add(price);
      }

      expect(rvi.getResultOrThrow()).toBe(0);
      expect(rvi.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});

testIndicatorContract({
  create: () => new RelativeVolatilityIndex({interval: 3, stddevInterval: 3}),
  divergentInput: 1_000,
  inputs: [10, 12, 11, 13, 14, 12, 12, 15],
});
