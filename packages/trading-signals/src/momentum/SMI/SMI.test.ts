import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {SMI} from './SMI.js';
import {TradingSignal} from '../../base/index.js';

describe('SMI', () => {
  /*
   * Hand-derived worksheet for interval=2, smooth1=2, smooth2=2. Both EMAs weight new inputs
   * with 2/3 and seed with their first input, so every intermediate value stays an exact fraction:
   *
   * | Candle          | HH | LL | Midpoint | Distance | Range |
   * | {h:10,l:8,c:9}  | window not full yet                   |
   * | {h:12,l:9,c:11} | 12 |  8 | 10       | +1       | 4     |
   * | {h:13,l:10,c:12}| 13 |  9 | 11       | +1       | 4     |
   * | {h:11,l:7,c:8}  | 13 |  7 | 10       | -2       | 6     |
   * | {h:12,l:9,c:10} | 12 |  7 | 9.5      | +0.5     | 5     |
   *
   * First smoothing of distance: 1, 1, -1, 0 — of range: 4, 4, 16/3, 46/9.
   * Second smoothing (starts once the first is stable) of distance: 1, -1/3, -1/9 — of range: 4, 44/9, 136/27.
   *
   * Candle 4: SMI = 100 * (-1/3) / (0.5 * 44/9)  = -150/11 ≈ -13.636364
   * Candle 5: SMI = 100 * (-1/9) / (0.5 * 136/27) = -75/17  ≈ -4.411765
   */
  const worksheetCandles = [
    {close: 9, high: 10, low: 8},
    {close: 11, high: 12, low: 9},
    {close: 12, high: 13, low: 10},
    {close: 8, high: 11, low: 7},
    {close: 10, high: 12, low: 9},
  ] as const;

  describe('getResultOrThrow', () => {
    it('locates the close relative to the midpoint of the high/low range', () => {
      const expectations = ['-13.636364', '-4.411765'] as const;
      const smi = new SMI({interval: 2, smooth1: 2, smooth2: 2});
      const offset = smi.getRequiredInputs() - 1;

      worksheetCandles.forEach((candle, i) => {
        const result = smi.add(candle);

        if (result !== null) {
          expect(result.toFixed(6)).toBe(expectations[i - offset]);
        }
      });

      expect(smi.isStable).toBe(true);
      expect(smi.getRequiredInputs()).toBe(4);
    });

    it('needs one range window plus both smoothing warm-ups by default', () => {
      const smi = new SMI();

      expect(smi.getRequiredInputs()).toBe(14);
    });

    it('reports the extremes when every close pins the top or bottom of its range', () => {
      const topPinned = new SMI();
      const bottomPinned = new SMI();

      for (let i = 0; i < 14; i++) {
        topPinned.add({close: 10 + i, high: 10 + i, low: 9 + i});
        bottomPinned.add({close: 99 - i, high: 100 - i, low: 99 - i});
      }

      expect(topPinned.getResultOrThrow()).toBe(100);
      expect(bottomPinned.getResultOrThrow()).toBe(-100);
    });

    it('returns a neutral reading instead of dividing by zero when the window is perfectly flat', () => {
      const smi = new SMI({interval: 2, smooth1: 2, smooth2: 2});
      const flatCandle = {close: 50, high: 50, low: 50} as const;

      for (let i = 0; i < 4; i++) {
        smi.add(flatCandle);
      }

      expect(smi.getResultOrThrow()).toBe(0);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      /*
       * Worksheet continued: the original candle widens the range to HH=14/LL=9 (midpoint 11.5,
       * distance +1.5, range 5) and yields exactly 100 * (17/27) / (0.5 * 136/27) = 25. Its
       * replacement drops the range to HH=12/LL=6 (midpoint 9, distance -2, range 6) and yields
       * 100 * (-25/27) / (0.5 * 148/27) = -1250/37 ≈ -33.783784.
       */
      const smi = new SMI({interval: 2, smooth1: 2, smooth2: 2});

      for (const candle of worksheetCandles) {
        smi.add(candle);
      }

      const originalValue = {close: 13, high: 14, low: 10} as const;
      const replacedValue = {close: 7, high: 12, low: 6} as const;

      const originalResult = smi.add(originalValue);

      expect(originalResult?.toFixed(6)).toBe('25.000000');

      const replacedResult = smi.replace(replacedValue);

      expect(replacedResult?.toFixed(6)).toBe('-33.783784');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = smi.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const smi = new SMI();

      expect(smi.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when the SMI indicates an overbought market', () => {
      const smi = new SMI();

      for (let i = 0; i < 14; i++) {
        smi.add({close: 10 + i, high: 10 + i, low: 9 + i});
      }

      expect(smi.getResultOrThrow()).toBeGreaterThanOrEqual(40);
      expect(smi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the SMI indicates an oversold market', () => {
      const smi = new SMI();

      for (let i = 0; i < 14; i++) {
        smi.add({close: 99 - i, high: 100 - i, low: 99 - i});
      }

      expect(smi.getResultOrThrow()).toBeLessThanOrEqual(-40);
      expect(smi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the SMI is between the oversold and overbought thresholds', () => {
      const smi = new SMI({interval: 2, smooth1: 2, smooth2: 2});
      const flatCandle = {close: 50, high: 50, low: 50} as const;

      for (let i = 0; i < 4; i++) {
        smi.add(flatCandle);
      }

      expect(smi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('treats a reading exactly at a custom threshold as overbought or oversold', () => {
      const bullishAtBoundary = new SMI({interval: 2, smooth1: 2, smooth2: 2}, {overbought: 100});
      const bearishAtBoundary = new SMI({interval: 2, smooth1: 2, smooth2: 2}, {oversold: -100});

      for (let i = 0; i < 4; i++) {
        bullishAtBoundary.add({close: 10 + i, high: 10 + i, low: 9 + i});
        bearishAtBoundary.add({close: 99 - i, high: 100 - i, low: 99 - i});
      }

      expect(bullishAtBoundary.getResultOrThrow()).toBe(100);
      expect(bullishAtBoundary.getSignal().state).toBe(TradingSignal.BULLISH);

      expect(bearishAtBoundary.getResultOrThrow()).toBe(-100);
      expect(bearishAtBoundary.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});

testIndicatorContract({
  create: () => new SMI({interval: 5, smooth1: 2, smooth2: 2}),
  divergentInput: {close: 500, high: 500, low: 400},
  inputs: [
    {close: 81.59, high: 82.15, low: 81.29},
    {close: 81.06, high: 81.89, low: 80.64},
    {close: 82.87, high: 83.03, low: 81.31},
    {close: 83.0, high: 83.3, low: 82.65},
    {close: 83.61, high: 83.85, low: 83.07},
    {close: 83.15, high: 83.9, low: 83.11},
    {close: 82.84, high: 83.33, low: 82.49},
    {close: 83.99, high: 84.3, low: 82.3},
  ],
});
