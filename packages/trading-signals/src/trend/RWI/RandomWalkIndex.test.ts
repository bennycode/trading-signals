import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {RandomWalkIndex} from './RandomWalkIndex.js';
import {TradingSignal} from '../../base/index.js';

describe('RandomWalkIndex', () => {
  describe('update', () => {
    it('reads above 1 when price covers more ground than a random walk would drift', () => {
      /*
       * Formula (Michael Poulos, "Of Trends And Random Walks", Technical Analysis of Stocks &
       * Commodities, 1991), scanning formulation as implemented by ta4j:
       * RWI High = max over k in 2..interval of (High - Low[k-1 candles ago]) / (ATR(k) * sqrt(k))
       * RWI Low  = max over k in 2..interval of (High[k-1 candles ago] - Low) / (ATR(k) * sqrt(k))
       * https://rtmath.net/helpFinAnalysis/html/934563a8-9171-42d2-8444-486691234b1d.html
       *
       * The expectations below are derived by hand with interval 3. Every candle climbs by 1
       * and every true range is 2, so ATR(2) = ATR(3) = 2 throughout:
       *
       * | Bar | High | Low | k=2 High          | k=3 High          | k=2 Low           | k=3 Low          |
       * |-----|------|-----|-------------------|-------------------|-------------------|------------------|
       * | 4   | 6    | 4   | (6-3)/(2√2)=1.061 | (6-2)/(2√3)=1.155 | (5-4)/(2√2)=0.354 | (4-4)/(2√3)=0    |
       * | 5   | 7    | 5   | (7-4)/(2√2)=1.061 | (7-3)/(2√3)=1.155 | (6-5)/(2√2)=0.354 | (5-5)/(2√3)=0    |
       *
       * Both lines report the strongest stretch: RWI High = 4/(2√3), RWI Low = 1/(2√2). The
       * steady climb keeps RWI High above 1, which is exactly the non-random reading the
       * indicator exists to flag.
       */
      const candles = [
        {close: 2, high: 3, low: 1},
        {close: 3, high: 4, low: 2},
        {close: 4, high: 5, low: 3},
        {close: 5, high: 6, low: 4},
        {close: 6, high: 7, low: 5},
      ] as const;
      const expectations = [
        {high: 1.1547005383792517, low: 0.35355339059327373},
        {high: 1.1547005383792517, low: 0.35355339059327373},
      ] as const;
      const rwi = new RandomWalkIndex(3);
      const offset = rwi.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = rwi.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(rwi.isStable).toBe(true);
      expect(rwi.getResultOrThrow().high).toBeGreaterThan(1);
    });

    it('reports the strongest stretch on each line independently', () => {
      /*
       * The two lines may pick different stretch lengths: with a pullback candle the upward
       * path stretches best over the full interval (k=3: (15-10)/(4√3)) while the downward
       * path stretches best over the short one (k=2: (16-11)/(4√2)). A single-lag formulation
       * would miss one of the two.
       */
      const rwi = new RandomWalkIndex(3);

      rwi.add({close: 10, high: 12, low: 8});
      rwi.add({close: 12, high: 14, low: 10});
      rwi.add({close: 14, high: 16, low: 12});
      rwi.add({close: 12, high: 15, low: 11});

      expect(rwi.getResultOrThrow()).toEqual({high: 0.7216878364870323, low: 0.8838834764831843});
    });

    it('reports zero on both lines when the market never moved', () => {
      const rwi = new RandomWalkIndex(2);

      rwi.add({close: 10, high: 10, low: 10});
      rwi.add({close: 10, high: 10, low: 10});
      rwi.add({close: 10, high: 10, low: 10});

      expect(rwi.getResultOrThrow()).toEqual({high: 0, low: 0});
      expect(rwi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('getRequiredInputs', () => {
    it('needs one candle more than the interval, which defaults to 14 periods', () => {
      expect(new RandomWalkIndex().getRequiredInputs()).toBe(15);
      expect(new RandomWalkIndex(3).getRequiredInputs()).toBe(4);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const rwi = new RandomWalkIndex(3);

      rwi.add({close: 10, high: 12, low: 8});
      rwi.add({close: 12, high: 14, low: 10});
      rwi.add({close: 14, high: 16, low: 12});

      const originalCandle = {close: 12, high: 15, low: 11} as const;
      const replacementCandle = {close: 18, high: 20, low: 16} as const;

      const originalResult = rwi.add(originalCandle);

      expect(originalResult).toEqual({high: 0.7216878364870323, low: 0.8838834764831843});

      /*
       * The breakout candle widens the true range, so Wilder's smoothing lifts ATR(2) to 5 and
       * ATR(3) to 14/3. Its low sits above the previous highs, which drives the raw downward
       * ratios to zero and below — the reported RWI Low is the strongest of them, exactly 0.
       */
      const replacedResult = rwi.replace(replacementCandle);

      expect(replacedResult).toEqual({high: 1.2371791482634837, low: 0});

      const restoredResult = rwi.replace(originalCandle);

      expect(restoredResult).toEqual({high: 0.7216878364870323, low: 0.8838834764831843});
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const rwi = new RandomWalkIndex(2);

      expect(rwi.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});

      rwi.add({close: 10, high: 11, low: 9});
      rwi.add({close: 10, high: 11, low: 9});

      expect(rwi.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH when the upward line trades above the downward one', () => {
      const rwi = new RandomWalkIndex(3);

      rwi.add({close: 2, high: 3, low: 1});
      rwi.add({close: 3, high: 4, low: 2});
      rwi.add({close: 4, high: 5, low: 3});
      rwi.add({close: 5, high: 6, low: 4});

      expect(rwi.getResultOrThrow()).toEqual({high: 1.1547005383792517, low: 0.35355339059327373});
      expect(rwi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the downward line trades above the upward one', () => {
      const rwi = new RandomWalkIndex(3);

      rwi.add({close: 6, high: 7, low: 5});
      rwi.add({close: 5, high: 6, low: 4});
      rwi.add({close: 4, high: 5, low: 3});
      rwi.add({close: 3, high: 4, low: 2});

      expect(rwi.getResultOrThrow()).toEqual({high: 0.35355339059327373, low: 1.1547005383792517});
      expect(rwi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when both lines are equal', () => {
      /*
       * Identical candles with a real trading range keep both paths symmetric: the reach from
       * the current high down to a past low equals the reach from a past high down to the
       * current low, so neither side gains an edge even though the market is moving.
       */
      const rwi = new RandomWalkIndex(2);

      rwi.add({close: 10, high: 11, low: 9});
      rwi.add({close: 10, high: 11, low: 9});
      rwi.add({close: 10, high: 11, low: 9});

      expect(rwi.getResultOrThrow()).toEqual({high: 0.7071067811865475, low: 0.7071067811865475});
      expect(rwi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags a change only when the signal switches its state', () => {
      const rwi = new RandomWalkIndex(2);

      rwi.add({close: 10, high: 11, low: 9});
      rwi.add({close: 10, high: 11, low: 9});
      rwi.add({close: 10, high: 11, low: 9});

      expect(rwi.getSignal()).toEqual({hasChanged: true, state: TradingSignal.SIDEWAYS});

      rwi.add({close: 18, high: 20, low: 14});

      expect(rwi.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});

      rwi.add({close: 24, high: 26, low: 20});

      expect(rwi.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});
    });
  });
});

testIndicatorContract({
  create: () => new RandomWalkIndex(2),
  divergentInput: {close: 1_000, high: 1_010, low: 990},
  inputs: [
    {close: 10, high: 12, low: 8},
    {close: 12, high: 14, low: 10},
    {close: 14, high: 16, low: 12},
    {close: 12, high: 15, low: 11},
  ],
});
