import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {WaveTrend} from './WaveTrend.js';
import {TradingSignal} from '../../base/index.js';

describe('WaveTrend', () => {
  describe('update', () => {
    it('normalizes the stretch of the average price from its channel and smooths it into wave and trigger lines', () => {
      /*
       * Formula (LazyBear, "WaveTrend Oscillator [WT]", TradingView, 2014):
       * ap  = hlc3
       * esa = ema(ap, channelInterval)
       * d   = ema(|ap - esa|, channelInterval)
       * ci  = (ap - esa) / (0.015 * d)
       * wt1 = ema(ci, averageInterval)
       * wt2 = sma(wt1, smoothingInterval)
       * https://www.tradingview.com/script/2KE8wTuF-Indicator-WaveTrend-Oscillator-WT/
       *
       * The expectations below are derived by hand with every interval set to 2, so each EMA
       * weights the incoming value with 2/3 and the previous reading with 1/3. On the first
       * candle the channel sits exactly on the average price, so the deviation is zero and the
       * flat-market guard pins ci to 0. Exact fractions:
       *
       * | Bar | High | Low | Close | ap | esa  | |ap-esa| | d     | ci     | wt1       | wt2      |
       * |-----|------|-----|-------|----|------|----------|-------|--------|-----------|----------|
       * | 1   | 12   | 8   | 10    | 10 | 10   | 0        | 0     | 0      | 0         | -        |
       * | 2   | 15   | 11  | 13    | 13 | 12   | 1        | 2/3   | 100    | 200/3     | 100/3    |
       * | 3   | 18   | 14  | 16    | 16 | 44/3 | 4/3      | 10/9  | 80     | 680/9     | 640/9    |
       * | 4   | 9    | 5   | 7     | 7  | 86/9 | 23/9     | 56/27 | -575/7 | -5590/189 | 4345/189 |
       */
      const candles = [
        {close: 10, high: 12, low: 8},
        {close: 13, high: 15, low: 11},
        {close: 16, high: 18, low: 14},
        {close: 7, high: 9, low: 5},
      ] as const;
      const expectations = [
        {wt1: '66.6667', wt2: '33.3333'},
        {wt1: '75.5556', wt2: '71.1111'},
        {wt1: '-29.5767', wt2: '22.9894'},
      ] as const;
      const wt = new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 2});
      const offset = wt.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = wt.add(candle);

        if (result) {
          const expected = expectations[i - offset];
          expect(result.wt1.toFixed(4)).toBe(expected.wt1);
          expect(result.wt2.toFixed(4)).toBe(expected.wt2);
        }
      });

      expect(wt.isStable).toBe(true);
    });

    it('reports zero on both lines when the market never leaves its channel', () => {
      /*
       * Identical candles keep the average price glued to its own channel, so there is no
       * deviation to normalize by. Both lines must stay at zero instead of turning NaN.
       */
      const wt = new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 2});

      wt.add({close: 8, high: 8, low: 8});
      wt.add({close: 8, high: 8, low: 8});
      wt.add({close: 8, high: 8, low: 8});

      expect(wt.getResultOrThrow()).toEqual({wt1: 0, wt2: 0});
      expect(wt.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('withholds results until the fast wave line completes its warm-up', () => {
      const wt = new WaveTrend({averageInterval: 3, channelInterval: 2, smoothingInterval: 2});

      expect(wt.add({close: 10, high: 12, low: 8})).toBeNull();
      expect(wt.add({close: 13, high: 15, low: 11})).toBeNull();
      expect(wt.add({close: 16, high: 18, low: 14})).not.toBeNull();
    });

    it('withholds results until the price channel completes its warm-up', () => {
      const wt = new WaveTrend({averageInterval: 2, channelInterval: 3, smoothingInterval: 2});

      expect(wt.add({close: 10, high: 12, low: 8})).toBeNull();
      expect(wt.add({close: 13, high: 15, low: 11})).toBeNull();
      expect(wt.add({close: 16, high: 18, low: 14})).not.toBeNull();
    });
  });

  describe('getRequiredInputs', () => {
    it("is driven by the slowest smoothing stage and defaults to LazyBear's 10/21/4 setup", () => {
      expect(new WaveTrend().getRequiredInputs()).toBe(21);
      expect(new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 2}).getRequiredInputs()).toBe(2);
      expect(new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 5}).getRequiredInputs()).toBe(5);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      /*
       * The first three candles match the hand-derived worksheet of the update test. Replacing
       * its fourth candle (ap = 7) with a rally candle (ap = 20) yields, in exact fractions:
       * esa = 164/9, |ap-esa| = 16/9, d = 14/9, ci = 1600/21, wt1 = 14360/189, wt2 = 14320/189.
       * Restoring the original candle must reproduce the worksheet values exactly, which
       * requires every smoothing stage to roll back to its reading from before the replacement.
       */
      const wt = new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 2});

      wt.add({close: 10, high: 12, low: 8});
      wt.add({close: 13, high: 15, low: 11});
      wt.add({close: 16, high: 18, low: 14});

      const originalCandle = {close: 7, high: 9, low: 5} as const;
      const replacementCandle = {close: 20, high: 22, low: 18} as const;

      const originalResult = wt.add(originalCandle);

      expect(originalResult?.wt1.toFixed(4)).toBe('-29.5767');
      expect(originalResult?.wt2.toFixed(4)).toBe('22.9894');

      const replacedResult = wt.replace(replacementCandle);

      expect(replacedResult?.wt1.toFixed(4)).toBe('75.9788');
      expect(replacedResult?.wt2.toFixed(4)).toBe('75.7672');

      const restoredResult = wt.replace(originalCandle);

      expect(restoredResult?.wt1.toFixed(4)).toBe('-29.5767');
      expect(restoredResult?.wt2.toFixed(4)).toBe('22.9894');
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const wt = new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 2});

      expect(wt.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});

      wt.add({close: 10, high: 12, low: 8});

      expect(wt.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH when the fast wave line trades above its trigger line', () => {
      const wt = new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 2});

      wt.add({close: 10, high: 12, low: 8});
      wt.add({close: 13, high: 15, low: 11});

      expect(wt.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the fast wave line trades below its trigger line', () => {
      const wt = new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 2});

      wt.add({close: 16, high: 18, low: 14});
      wt.add({close: 13, high: 15, low: 11});

      expect(wt.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when both lines are equal', () => {
      const wt = new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 2});

      wt.add({close: 8, high: 8, low: 8});
      wt.add({close: 8, high: 8, low: 8});

      expect(wt.getResultOrThrow()).toEqual({wt1: 0, wt2: 0});
      expect(wt.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags a change only when the signal switches its state', () => {
      const wt = new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 2});

      wt.add({close: 8, high: 8, low: 8});
      wt.add({close: 8, high: 8, low: 8});

      expect(wt.getSignal()).toEqual({hasChanged: true, state: TradingSignal.SIDEWAYS});

      wt.add({close: 14, high: 16, low: 12});

      expect(wt.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});

      wt.add({close: 20, high: 22, low: 18});

      expect(wt.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});
    });
  });
});

testIndicatorContract({
  create: () => new WaveTrend({averageInterval: 2, channelInterval: 2, smoothingInterval: 2}),
  divergentInput: {close: 1_000, high: 1_010, low: 990},
  inputs: [
    {close: 10, high: 12, low: 8},
    {close: 13, high: 15, low: 11},
    {close: 16, high: 18, low: 14},
    {close: 7, high: 9, low: 5},
  ],
});
