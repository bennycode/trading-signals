import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {ConnorsRSI} from './ConnorsRSI.js';
import {TradingSignal} from '../../base/index.js';
import {RSI} from '../RSI/RSI.js';

describe('ConnorsRSI', () => {
  describe('update', () => {
    it('averages the price RSI, the streak RSI and the percent rank of the one-bar return', () => {
      /*
       * CRSI = (RSI(close) + RSI(streak) + PercentRank(one-bar return)) / 3, as published in
       * "An Introduction to ConnorsRSI" (Connors Research Trading Strategy Series, 2012) and
       * implemented by TradingView:
       * https://www.tradingview.com/support/solutions/43000502017-connors-rsi-crsi/
       * The expectations compose the library's own Tulip-verified RSI with hand-derived streak
       * and percent-rank series.
       */
      const closes = [100, 102, 101, 101, 103, 104, 104.5, 103, 101, 101] as const;
      /*
       * One streak per close change: rising closes count 1, 2, 3, ..., falling closes -1, -2, ...
       * and an unchanged close resets the streak to 0.
       */
      const streaks = [1, -1, 0, 1, 2, 3, -1, -2, 0] as const;
      // Share of the previous 4 one-bar returns that are strictly smaller than the current one.
      const percentRanks = [50, 50, 0, 0, 50] as const;

      const crsi = new ConnorsRSI({percentRankInterval: 4, rsiInterval: 3, streakRsiInterval: 2});
      const priceRsi = new RSI(3);
      const streakRsi = new RSI(2);
      const offset = crsi.getRequiredInputs() - 1;

      closes.forEach((close, i) => {
        const result = crsi.add(close);
        priceRsi.add(close);

        if (i > 0) {
          streakRsi.add(streaks[i - 1]);
        }

        if (i < offset) {
          expect(result).toBeNull();
        } else {
          const expected = (priceRsi.getResultOrThrow() + streakRsi.getResultOrThrow() + percentRanks[i - offset]) / 3;
          expect(result).toBe(expected);
        }
      });

      expect(crsi.isStable).toBe(true);
      expect(crsi.getResultOrThrow().toFixed(2)).toBe('45.55');
    });

    it('counts only strictly smaller returns in the percent rank', () => {
      /*
       * In an unchanged market every one-bar return is 0, so the percent rank stays at 0 because
       * an equal return signals no additional strength. Both RSI components read 100 through
       * their division-by-zero guards, pinning the result to (100 + 100 + 0) / 3.
       */
      const closes = [100, 100, 100, 100] as const;
      const crsi = new ConnorsRSI({percentRankInterval: 2, rsiInterval: 2, streakRsiInterval: 2});

      for (const close of closes) {
        crsi.add(close);
      }

      expect(crsi.getResultOrThrow()).toBe(200 / 3);
    });

    it('replaces the most recently added value', () => {
      const closes = [100, 102, 101, 101, 103, 104, 104.5, 103, 101] as const;
      const crsi = new ConnorsRSI({percentRankInterval: 4, rsiInterval: 3, streakRsiInterval: 2});

      for (const close of closes) {
        crsi.add(close);
      }

      const composeExpectedResult = (finalClose: number, finalStreak: number, percentRank: number) => {
        const priceRsi = new RSI(3);
        const streakRsi = new RSI(2);

        for (const close of [...closes, finalClose]) {
          priceRsi.add(close);
        }

        for (const streak of [1, -1, 0, 1, 2, 3, -1, -2, finalStreak]) {
          streakRsi.add(streak);
        }

        return (priceRsi.getResultOrThrow() + streakRsi.getResultOrThrow() + percentRank) / 3;
      };

      /*
       * An unchanged close keeps the streak at 0 and its zero return outranks the two negative
       * returns in the window.
       */
      const originalResult = crsi.add(101);

      expect(originalResult).toBe(composeExpectedResult(101, 0, 50));

      /*
       * The replacement extends the down streak to -3 and its return drops below every windowed
       * return, so both the streak bookkeeping and the percent-rank window must roll back.
       */
      const replacedResult = crsi.replace(99);

      expect(replacedResult).toBe(composeExpectedResult(99, -3, 0));

      const restoredResult = crsi.replace(101);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getRequiredInputs', () => {
    it("defaults to Connors' published intervals of 3, 2 and 100", () => {
      const crsi = new ConnorsRSI();

      expect(crsi.rsiInterval).toBe(3);
      expect(crsi.streakRsiInterval).toBe(2);
      expect(crsi.percentRankInterval).toBe(100);
      expect(crsi.getRequiredInputs()).toBe(102);
    });

    it('waits for the price RSI when it dominates the warm-up', () => {
      const crsi = new ConnorsRSI({percentRankInterval: 2, rsiInterval: 10, streakRsiInterval: 2});
      const requiredInputs = crsi.getRequiredInputs();

      expect(requiredInputs).toBe(11);

      for (let close = 1; close < requiredInputs; close++) {
        expect(crsi.add(close)).toBeNull();
      }

      expect(crsi.add(requiredInputs)).not.toBeNull();
    });

    it('waits for the streak RSI when it dominates the warm-up', () => {
      const crsi = new ConnorsRSI({percentRankInterval: 2, rsiInterval: 2, streakRsiInterval: 10});
      const requiredInputs = crsi.getRequiredInputs();

      expect(requiredInputs).toBe(12);

      for (let close = 1; close < requiredInputs; close++) {
        expect(crsi.add(close)).toBeNull();
      }

      expect(crsi.add(requiredInputs)).not.toBeNull();
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const crsi = new ConnorsRSI();

      expect(crsi.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('signals bullish pressure when the market is overbought', () => {
      /*
       * Accelerating gains max out all three components: both RSI readings sit at 100 and every
       * windowed return is strictly smaller than the current one.
       */
      const closes = [100, 101, 103, 106] as const;
      const crsi = new ConnorsRSI({percentRankInterval: 2, rsiInterval: 2, streakRsiInterval: 2});

      for (const close of closes) {
        crsi.add(close);
      }

      expect(crsi.getResultOrThrow()).toBe(100);
      expect(crsi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('signals bearish pressure when the market is oversold', () => {
      /*
       * Accelerating losses floor all three components: both RSI readings sit at 0 and no windowed
       * return is smaller than the current one.
       */
      const closes = [100, 99, 97, 94] as const;
      const crsi = new ConnorsRSI({percentRankInterval: 2, rsiInterval: 2, streakRsiInterval: 2});

      for (const close of closes) {
        crsi.add(close);
      }

      expect(crsi.getResultOrThrow()).toBe(0);
      expect(crsi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('signals a sideways market between the thresholds', () => {
      const closes = [100, 102, 101, 101, 103, 104] as const;
      const crsi = new ConnorsRSI({percentRankInterval: 4, rsiInterval: 3, streakRsiInterval: 2});

      for (const close of closes) {
        crsi.add(close);
      }

      const result = crsi.getResultOrThrow();

      expect(result).toBeGreaterThan(10);
      expect(result).toBeLessThan(90);
      expect(crsi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('reports bullish pressure when the result sits exactly on the overbought threshold', () => {
      const closes = [100, 100, 100, 100] as const;
      const crsi = new ConnorsRSI({
        percentRankInterval: 2,
        rsiInterval: 2,
        signalThresholds: {overbought: 200 / 3},
        streakRsiInterval: 2,
      });

      for (const close of closes) {
        crsi.add(close);
      }

      expect(crsi.getResultOrThrow()).toBe(200 / 3);
      expect(crsi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('reports bearish pressure when the result sits exactly on the oversold threshold', () => {
      const closes = [100, 100, 100, 100] as const;
      const crsi = new ConnorsRSI({
        percentRankInterval: 2,
        rsiInterval: 2,
        signalThresholds: {oversold: 200 / 3},
        streakRsiInterval: 2,
      });

      for (const close of closes) {
        crsi.add(close);
      }

      expect(crsi.getResultOrThrow()).toBe(200 / 3);
      expect(crsi.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});

testIndicatorContract({
  create: () => new ConnorsRSI({percentRankInterval: 4, rsiInterval: 3, streakRsiInterval: 2}),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99],
});
