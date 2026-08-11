import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {TradingSignal} from '../../base/index.js';
import {TTMSqueeze} from './TTMSqueeze.js';

/*
 * Hand-derived worksheet with interval 3 (config: BB(3, x2), KC(3, x1.5, ATR 3), momentum over 3):
 *
 * | Bar | High | Low | Close | HH3 | LL3 | SMA3 | Anchor = ((HH3+LL3)/2 + SMA3)/2 | Distance |
 * |-----|------|-----|-------|-----|-----|------|---------------------------------|----------|
 * | 1   | 102  | 96  | 99    | -   | -   | -    | -                               | -        |
 * | 2   | 102  | 96  | 99    | -   | -   | -    | -                               | -        |
 * | 3   | 102  | 96  | 99    | 102 | 96  | 99   | (99 + 99)/2 = 99                | 0        |
 * | 4   | 104  | 98  | 102   | 104 | 96  | 100  | (100 + 100)/2 = 100             | 2        |
 * | 5   | 106  | 94  | 105   | 106 | 94  | 102  | (100 + 102)/2 = 101             | 4        |
 * | 6   | 144  | 100 | 138   | 144 | 94  | 115  | (119 + 115)/2 = 117             | 21       |
 *
 * Momentum is the least-squares line through the last 3 distances, read at the newest bar.
 * For 3 points that is mean + (last - first)/2:
 * - Bar 5: [0, 2, 4]  -> 6/3  + (4 - 0)/2  = 2 + 2   = 4
 * - Bar 6: [2, 4, 21] -> 27/3 + (21 - 2)/2 = 9 + 9.5 = 18.5
 *
 * Squeeze state compares BB(3, x2) against KC(3, x1.5) with an EMA(3) middle line and a
 * Wilder-smoothed ATR(3) width (True Ranges: 6, 6, 6, 6, 12, 44):
 * - Bar 5: BB = 102 +/- 2*sqrt(6)     -> [97.10, 106.90] sits inside KC = 102.75  +/- 1.5*8 -> [90.75, 114.75]  => on
 * - Bar 6: BB = 115 +/- 2*sqrt(266)   -> [82.38, 147.62] escapes KC     = 120.375 +/- 1.5*20 -> [90.375, 150.375] => off
 */
const worksheetCandles = [
  {close: 99, high: 102, low: 96},
  {close: 99, high: 102, low: 96},
  {close: 99, high: 102, low: 96},
  {close: 102, high: 104, low: 98},
  {close: 105, high: 106, low: 94},
  {close: 138, high: 144, low: 100},
] as const;

describe('TTMSqueeze', () => {
  describe('update', () => {
    it('detects the squeeze in a tight range and its release with rising momentum on the breakout', () => {
      const expectations = [
        {isSqueezed: true, momentum: 4},
        {isSqueezed: false, momentum: 18.5},
      ] as const;
      const squeeze = new TTMSqueeze({bbInterval: 3, kcInterval: 3});
      const offset = squeeze.getRequiredInputs() - 1;

      worksheetCandles.forEach((candle, i) => {
        const result = squeeze.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(squeeze.isStable).toBe(true);
    });

    it('mirrors the momentum sign when the same move plays out to the downside', () => {
      /*
       * The worksheet candles mirrored at 200 (close' = 200 - close, high' = 200 - low,
       * low' = 200 - high): distances and momentum negate exactly, while both envelope
       * widths are unaffected, so the squeeze states stay identical.
       */
      const mirroredCandles = worksheetCandles.map(({close, high, low}) => ({
        close: 200 - close,
        high: 200 - low,
        low: 200 - high,
      }));
      const expectations = [
        {isSqueezed: true, momentum: -4},
        {isSqueezed: false, momentum: -18.5},
      ] as const;
      const squeeze = new TTMSqueeze({bbInterval: 3, kcInterval: 3});
      const offset = squeeze.getRequiredInputs() - 1;

      mirroredCandles.forEach((candle, i) => {
        const result = squeeze.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(squeeze.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('reports no squeeze when a dead market collapses both envelopes onto the price', () => {
      /*
       * Without any trading range the standard deviation and the ATR are both zero, so the
       * Bollinger Bands and the Keltner Channel coincide on the close. A zero-width envelope
       * cannot trade strictly inside another, so the market is not squeezed - it is dead.
       */
      const squeeze = new TTMSqueeze({bbInterval: 3, kcInterval: 3});

      for (let i = 0; i < 5; i++) {
        squeeze.add({close: 100, high: 100, low: 100});
      }

      expect(squeeze.getResultOrThrow()).toEqual({isSqueezed: false, momentum: 0});
    });

    it('keeps a wide Bollinger envelope from reporting a squeeze in the same tight range', () => {
      const squeeze = new TTMSqueeze({bbInterval: 3, bbMultiplier: 6, kcInterval: 3, kcMultiplier: 1.5});

      for (const candle of worksheetCandles.slice(0, 5)) {
        squeeze.add(candle);
      }

      // BB = 102 +/- 6*sqrt(6) -> [87.30, 116.70] overlaps KC = [90.75, 114.75] on both sides
      expect(squeeze.getResultOrThrow()).toEqual({isSqueezed: false, momentum: 4});
    });

    it('keeps the breakout inside a wide Keltner Channel', () => {
      const squeeze = new TTMSqueeze({bbInterval: 3, bbMultiplier: 2, kcInterval: 3, kcMultiplier: 3});

      for (const candle of worksheetCandles) {
        squeeze.add(candle);
      }

      // BB = [82.38, 147.62] still fits into KC = 120.375 +/- 3*20 -> [60.375, 180.375]
      expect(squeeze.getResultOrThrow()).toEqual({isSqueezed: true, momentum: 18.5});
    });

    it('waits for the Bollinger Bands when they warm up slower than the momentum', () => {
      const squeeze = new TTMSqueeze({bbInterval: 6, kcInterval: 3});

      expect(squeeze.getRequiredInputs()).toBe(6);

      worksheetCandles.slice(0, 5).forEach(candle => {
        expect(squeeze.add(candle)).toBeNull();
      });

      expect(squeeze.add(worksheetCandles[5])).not.toBeNull();
    });

    it('waits for the Keltner Channel when the Bollinger Bands are already stable', () => {
      const squeeze = new TTMSqueeze({bbInterval: 2, kcInterval: 3});

      squeeze.add(worksheetCandles[0]);

      expect(squeeze.add(worksheetCandles[1])).toBeNull();
    });
  });

  describe('getRequiredInputs', () => {
    it('defaults to the interval of 20 candles popularized for the squeeze, warming up over 39 candles', () => {
      expect(new TTMSqueeze().getRequiredInputs()).toBe(39);
      expect(new TTMSqueeze({bbInterval: 3, kcInterval: 3}).getRequiredInputs()).toBe(5);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const squeeze = new TTMSqueeze({bbInterval: 3, kcInterval: 3});

      for (const candle of worksheetCandles.slice(0, 5)) {
        squeeze.add(candle);
      }

      const originalCandle = worksheetCandles[5];
      // Distances become [2, 4, 0] -> momentum = 6/3 + (0 - 2)/2 = 1, and the calm candle keeps the squeeze on
      const replacementCandle = {close: 102, high: 108, low: 98} as const;

      const originalResult = squeeze.add(originalCandle);

      expect(originalResult).toEqual({isSqueezed: false, momentum: 18.5});

      const replacedResult = squeeze.replace(replacementCandle);

      expect(replacedResult).toEqual({isSqueezed: true, momentum: 1});

      const restoredResult = squeeze.replace(originalCandle);

      expect(restoredResult).toEqual({isSqueezed: false, momentum: 18.5});
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const squeeze = new TTMSqueeze({bbInterval: 3, kcInterval: 3});

      expect(squeeze.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});

      for (const candle of worksheetCandles.slice(0, 4)) {
        squeeze.add(candle);
      }

      expect(squeeze.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH when the momentum is positive', () => {
      const squeeze = new TTMSqueeze({bbInterval: 3, kcInterval: 3});

      for (const candle of worksheetCandles.slice(0, 5)) {
        squeeze.add(candle);
      }

      expect(squeeze.getResultOrThrow().momentum).toBe(4);
      expect(squeeze.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the momentum is negative', () => {
      const squeeze = new TTMSqueeze({bbInterval: 3, kcInterval: 3});

      for (const {close, high, low} of worksheetCandles.slice(0, 5)) {
        squeeze.add({close: 200 - close, high: 200 - low, low: 200 - high});
      }

      expect(squeeze.getResultOrThrow().momentum).toBe(-4);
      expect(squeeze.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS while a flat market drifts along its own anchor', () => {
      const squeeze = new TTMSqueeze({bbInterval: 3, kcInterval: 3});

      for (let i = 0; i < 5; i++) {
        squeeze.add({close: 100, high: 101, low: 99});
      }

      expect(squeeze.getResultOrThrow()).toEqual({isSqueezed: true, momentum: 0});
      expect(squeeze.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags a change only when the signal switches its state', () => {
      const squeeze = new TTMSqueeze({bbInterval: 3, kcInterval: 3});

      for (let i = 0; i < 5; i++) {
        squeeze.add({close: 100, high: 101, low: 99});
      }

      expect(squeeze.getSignal()).toEqual({hasChanged: true, state: TradingSignal.SIDEWAYS});

      squeeze.add({close: 118, high: 120, low: 100});

      expect(squeeze.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});

      squeeze.add({close: 124, high: 125, low: 110});

      expect(squeeze.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});
    });
  });
});

testIndicatorContract({
  create: () => new TTMSqueeze({bbInterval: 3, kcInterval: 3}),
  divergentInput: {close: 1_000, high: 1_010, low: 990},
  inputs: worksheetCandles,
});
