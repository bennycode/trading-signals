import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {RogersSatchellVolatility} from './RogersSatchellVolatility.js';

describe('RogersSatchellVolatility', () => {
  describe('constructor', () => {
    it('uses a 14-bar window by default', () => {
      const rsv = new RogersSatchellVolatility();

      expect(rsv.interval).toBe(14);
      expect(rsv.getRequiredInputs()).toBe(14);
    });

    it('rejects a window below a single bar', () => {
      expect(() => new RogersSatchellVolatility(0)).toThrowError('interval must be >= 1, got "0"');
      expect(() => new RogersSatchellVolatility(-3)).toThrowError('interval must be >= 1, got "-3"');
    });

    it('accepts a single-bar window, because one candle already carries a full variance estimate', () => {
      /*
       * ln(H/C)·ln(H/O) + ln(L/C)·ln(L/O) = ln2·ln4 + ln¼·ln½ = 4·ln²2
       * RSV = √(4·ln²2) = 2·ln2 ≈ 1.386294
       */
      const rsv = new RogersSatchellVolatility(1);

      const result = rsv.add({close: 100, high: 200, low: 25, open: 50});

      expect(result).toBe(1.3862943611198906);
      expect(rsv.isStable).toBe(true);
    });
  });

  describe('getResultOrThrow', () => {
    it('takes the root of the mean per-bar variance estimate over the window', () => {
      /*
       * Hand-derived worksheet with candles whose price ratios are powers of 2, so every log range
       * collapses to a multiple of ln 2:
       *
       * open | high | low | close | ln(H/C)·ln(H/O) | ln(L/C)·ln(L/O) | variance estimate
       *   50 |  200 |  25 |   100 | ln2 · ln4       | ln¼ · ln½       | 4·ln²2
       *  100 |  100 | 100 |   100 | 0               | 0               | 0
       *  100 |  200 |  50 |   100 | ln2 · ln2       | ln½ · ln½       | 2·ln²2
       *
       * RSV = √((4·ln²2 + 0 + 2·ln²2) / 3) = √2 · ln2 ≈ 0.980258
       */
      const candles = [
        {close: 100, high: 200, low: 25, open: 50},
        {close: 100, high: 100, low: 100, open: 100},
        {close: 100, high: 200, low: 50, open: 100},
      ] as const;
      const rsv = new RogersSatchellVolatility(3);

      for (const candle of candles) {
        rsv.add(candle);
      }

      expect(rsv.getResultOrThrow()).toBe(0.9802581434685471);
    });

    it('matches the QuantConnect LEAN reference results', () => {
      /*
       * The candles are the first 20 rows of LEAN's Rogers-Satchell baseline (SPY daily bars), the
       * expectations its "RSV9" column. LEAN only ever looks back one interval, so a leading slice
       * of the series yields the same results as a full run.
       *
       * https://raw.githubusercontent.com/QuantConnect/Lean/85ca5be258f5330a30925da8937237010b6eab64/Tests/TestData/spy_with_rsv.csv
       */
      const candles = [
        {close: 151.89, high: 151.89, low: 150.49, open: 151.16},
        {close: 149, high: 152.86, low: 149, open: 152.63},
        {close: 150.02, high: 150.2, low: 148.73, open: 149.72},
        {close: 151.91, high: 152.33, low: 149.76, open: 149.89},
        {close: 151.61, high: 152.87, low: 151.41, open: 151.9},
        {close: 152.11, high: 152.34, low: 150.41, open: 151.09},
        {close: 152.92, high: 152.92, low: 151.52, open: 151.76},
        {close: 154.29, high: 154.7, low: 153.64, open: 153.66},
        {close: 154.5, high: 154.92, low: 154.16, open: 154.84},
        {close: 154.78, high: 154.98, low: 154.52, open: 154.71},
        {close: 155.44, high: 155.65, low: 154.66, open: 155.46},
        {close: 156.03, high: 156.04, low: 155.13, open: 155.33},
        {close: 155.68, high: 156.1, low: 155.21, open: 155.92},
        {close: 155.9, high: 156.12, low: 155.23, open: 155.76},
        {close: 156.73, high: 156.8, low: 156.22, open: 156.31},
        {close: 155.83, high: 156.04, low: 155.31, open: 155.85},
        {close: 154.97, high: 155.64, low: 154.2, open: 154.34},
        {close: 154.61, high: 155.51, low: 153.59, open: 155.3},
        {close: 155.69, high: 155.95, low: 155.26, open: 155.52},
        {close: 154.36, high: 155.64, low: 154.1, open: 154.75},
      ] as const;
      const expectations = [
        '0.0063414884',
        '0.0060102970',
        '0.0059086066',
        '0.0053832859',
        '0.0049528328',
        '0.0044939676',
        '0.0036801386',
        '0.0036602475',
        '0.0039837426',
        '0.0048632786',
        '0.0049191289',
        '0.0052135579',
      ] as const;
      const rsv = new RogersSatchellVolatility(9);
      const offset = rsv.getRequiredInputs() - 1;
      let verifiedBars = 0;

      candles.forEach((candle, i) => {
        const result = rsv.add(candle);

        if (result !== null) {
          verifiedBars++;
          expect(result.toFixed(10)).toBe(expectations[i - offset]);
        }
      });

      expect(verifiedBars).toBe(expectations.length);
    });

    it('reports exactly 0 for a flat market', () => {
      const rsv = new RogersSatchellVolatility(3);

      for (let i = 0; i < 3; i++) {
        rsv.add({close: 100, high: 100, low: 100, open: 100});
      }

      expect(rsv.getResultOrThrow()).toBe(0);
    });

    it('reads a wickless bar running straight from its open at the low to its close at the high as drift, not volatility', () => {
      const rsv = new RogersSatchellVolatility(1);

      const result = rsv.add({close: 400, high: 400, low: 100, open: 100});

      expect(result).toBe(0);
    });

    it('reads a candle with a zero or negative price component as carrying no measurable volatility', () => {
      /*
       * The window pairs the worksheet's first candle (4·ln²2) with a bar that crashed to zero.
       * The broken bar contributes exactly nothing instead of poisoning the mean with the
       * undefined log range of a non-positive price:
       *
       * RSV = √((4·ln²2 + 0) / 2) = √2 · ln2 ≈ 0.980258
       */
      const rsv = new RogersSatchellVolatility(2);

      rsv.add({close: 100, high: 200, low: 25, open: 50});
      const result = rsv.add({close: 100, high: 100, low: 0, open: 100});

      expect(result).toBe(0.9802581434685471);
    });

    it('reads a candle quoting negative prices as carrying no measurable volatility', () => {
      const rsv = new RogersSatchellVolatility(1);

      const result = rsv.add({close: 5, high: 10, low: -2, open: 5});

      expect(result).toBe(0);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const candles = [
        {close: 100, high: 200, low: 25, open: 50},
        {close: 100, high: 100, low: 100, open: 100},
        {close: 100, high: 200, low: 50, open: 100},
      ] as const;
      const rsv = new RogersSatchellVolatility(3);

      for (const candle of candles) {
        rsv.add(candle);
      }

      expect(rsv.getResultOrThrow()).toBe(0.9802581434685471);

      // Runs straight from its open at the low to its close at the high → pure drift, variance estimate 0
      const originalValue = {close: 400, high: 400, low: 100, open: 100} as const;
      // Doubles every price ratio of the worksheet's first candle → variance estimate 4·ln²2
      const replacedValue = {close: 400, high: 800, low: 100, open: 200} as const;

      // Window [0, 2·ln²2, 0] → √((2·ln²2) / 3)
      const originalResult = rsv.add(originalValue);

      expect(originalResult).toBe(0.5659523030068885);

      // Window [0, 2·ln²2, 4·ln²2] → √((6·ln²2) / 3)
      const replacedResult = rsv.replace(replacedValue);

      expect(replacedResult).toBe(0.9802581434685471);

      const restoredResult = rsv.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });
});

testIndicatorContract({
  create: () => new RogersSatchellVolatility(3),
  divergentInput: {close: 400, high: 800, low: 100, open: 200},
  inputs: [
    {close: 151.89, high: 151.89, low: 150.49, open: 151.16},
    {close: 149, high: 152.86, low: 149, open: 152.63},
    {close: 150.02, high: 150.2, low: 148.73, open: 149.72},
    {close: 151.91, high: 152.33, low: 149.76, open: 149.89},
  ],
});
