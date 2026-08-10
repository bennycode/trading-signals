import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {IchimokuCloud} from './IchimokuCloud.js';

describe('IchimokuCloud', () => {
  describe('constructor', () => {
    it('uses the intervals 9, 26 and 52 published by Goichi Hosoda by default', () => {
      const ichimoku = new IchimokuCloud();

      expect(ichimoku.conversionInterval).toBe(9);
      expect(ichimoku.baseInterval).toBe(26);
      expect(ichimoku.spanBInterval).toBe(52);
    });
  });

  describe('getRequiredInputs', () => {
    it('reports the slowest of the three windows', () => {
      expect(new IchimokuCloud().getRequiredInputs()).toBe(52);
      expect(new IchimokuCloud({baseInterval: 3, conversionInterval: 10, spanBInterval: 4}).getRequiredInputs()).toBe(
        10
      );
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates each line as the midpoint of its own window', () => {
      /*
       * Hand-derived with the tiny windows 2/3/4, chosen so every window carries a different extreme.
       * Each line is (highest high + lowest low) / 2 of its window, Span A is the middle of the
       * conversion and base lines:
       *
       * | Bar | High | Low | Conversion (2)     | Base (3)          | Span A               | Span B (4)          |
       * |-----|------|-----|--------------------|-------------------|----------------------|---------------------|
       * | 1   | 20   | 2   | -                  | -                 | -                    | -                   |
       * | 2   | 16   | 6   | -                  | -                 | -                    | -                   |
       * | 3   | 11   | 7   | -                  | -                 | -                    | -                   |
       * | 4   | 10   | 8   | (11 + 7) / 2 = 9   | (16 + 6) / 2 = 11 | (9 + 11) / 2 = 10    | (20 + 2) / 2 = 11   |
       * | 5   | 9    | 5   | (10 + 5) / 2 = 7.5 | (11 + 5) / 2 = 8  | (7.5 + 8) / 2 = 7.75 | (16 + 5) / 2 = 10.5 |
       */
      const candles = [
        {high: 20, low: 2},
        {high: 16, low: 6},
        {high: 11, low: 7},
        {high: 10, low: 8},
        {high: 9, low: 5},
      ] as const;
      const expectations = [
        {base: 11, conversion: 9, spanA: 10, spanB: 11},
        {base: 8, conversion: 7.5, spanA: 7.75, spanB: 10.5},
      ] as const;
      const ichimoku = new IchimokuCloud({baseInterval: 3, conversionInterval: 2, spanBInterval: 4});
      const offset = ichimoku.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = ichimoku.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(ichimoku.isStable).toBe(true);
    });

    it('is compatible with results from Skender.Stock.Indicators', () => {
      /*
       * Test data verified with the Ichimoku(9, 26, 52) baseline of "Skender.Stock.Indicators" v3.0.0.
       * Candles are the first 70 high/low pairs of its reference quote history:
       * https://github.com/DaveSkender/Stock.Indicators/blob/3.0.0/tests/indicators/_testdata/quotes/default.csv#L2-L71
       * Conversion (Tenkan-sen) and base (Kijun-sen) expectations are its committed baseline values for the
       * same bars:
       * https://github.com/DaveSkender/Stock.Indicators/blob/3.0.0/tests/indicators/_testdata/results/ichimoku.standard.json#L410-L561
       * Skender stores the senkou spans chart-aligned, displaced 26 rows into the future, so the span
       * expectations for bar i are taken from its row i + 26 — the values it computed at bar i:
       * https://github.com/DaveSkender/Stock.Indicators/blob/3.0.0/tests/indicators/_testdata/results/ichimoku.standard.json#L618-L769
       */
      const candles = [
        {high: 213.35, low: 211.52},
        {high: 214.22, low: 213.15},
        {high: 214.06, low: 213.02},
        {high: 215.17, low: 213.42},
        {high: 214.53, low: 213.91},
        {high: 214.89, low: 213.52},
        {high: 214.55, low: 213.13},
        {high: 214.22, low: 212.53},
        {high: 214.84, low: 214.17},
        {high: 214.25, low: 213.33},
        {high: 214.27, low: 213.42},
        {high: 214.46, low: 212.96},
        {high: 214.75, low: 213.49},
        {high: 214.28, low: 212.83},
        {high: 215.48, low: 213.77},
        {high: 216.89, low: 215.89},
        {high: 217.02, low: 216.36},
        {high: 216.91, low: 216.12},
        {high: 215.59, low: 213.9},
        {high: 215.03, low: 213.82},
        {high: 215.96, low: 214.4},
        {high: 215.5, low: 214.29},
        {high: 216.87, low: 215.84},
        {high: 216.66, low: 215.92},
        {high: 216.97, low: 216.09},
        {high: 216.72, low: 215.7},
        {high: 218.19, low: 216.84},
        {high: 218.97, low: 217.88},
        {high: 220.19, low: 219.23},
        {high: 220.8, low: 219.33},
        {high: 222.15, low: 220.5},
        {high: 222.16, low: 220.93},
        {high: 222.1, low: 221.01},
        {high: 223.62, low: 222.5},
        {high: 223.47, low: 222.8},
        {high: 223.81, low: 222.55},
        {high: 223.71, low: 222.41},
        {high: 224.2, low: 223.29},
        {high: 223.86, low: 222.98},
        {high: 227.04, low: 225.2},
        {high: 226.34, low: 225.05},
        {high: 225.43, low: 224.6},
        {high: 224.97, low: 223.92},
        {high: 224.64, low: 223.68},
        {high: 224.51, low: 223.34},
        {high: 224.13, low: 222.72},
        {high: 224.87, low: 223.52},
        {high: 224.72, low: 224.13},
        {high: 224.13, low: 223.14},
        {high: 226.21, low: 224.18},
        {high: 225.99, low: 224.95},
        {high: 225.8, low: 224.91},
        {high: 225.22, low: 224.24},
        {high: 225.46, low: 221.64},
        {high: 222.61, low: 221.13},
        {high: 223.31, low: 221.66},
        {high: 223.02, low: 221.05},
        {high: 221.96, low: 219.77},
        {high: 223.75, low: 221.22},
        {high: 223.75, low: 222.72},
        {high: 224.43, low: 223.24},
        {high: 224.42, low: 223.63},
        {high: 223.96, low: 221.95},
        {high: 223.53, low: 222.56},
        {high: 225.25, low: 222.55},
        {high: 223.97, low: 222.44},
        {high: 223.93, low: 222.64},
        {high: 224.18, low: 222.73},
        {high: 223.15, low: 221.41},
        {high: 222.95, low: 221.82},
      ] as const;
      const expectations = [
        {base: '221.9400', conversion: '224.4650', spanA: '223.2025', spanB: '219.2800'},
        {base: '222.4600', conversion: '224.4650', spanA: '223.4625', spanB: '219.7850'},
        {base: '223.1350', conversion: '223.9250', spanA: '223.5300', spanB: '219.7850'},
        {base: '223.1850', conversion: '223.6700', spanA: '223.4275', spanB: '219.7850'},
        {base: '223.7700', conversion: '223.6700', spanA: '223.7200', spanB: '219.7850'},
        {base: '223.9850', conversion: '223.6300', spanA: '223.8075', spanB: '219.7850'},
        {base: '223.4050', conversion: '222.9900', spanA: '223.1975', spanB: '219.7850'},
        {base: '223.4050', conversion: '222.8800', spanA: '223.1425', spanB: '219.7850'},
        {base: '223.4050', conversion: '222.7850', spanA: '223.0950', spanB: '219.9350'},
        {base: '223.4050', conversion: '222.6150', spanA: '223.0100', spanB: '219.9350'},
        {base: '223.4050', conversion: '222.6150', spanA: '223.0100', spanB: '219.9350'},
        {base: '223.4050', conversion: '222.1000', spanA: '222.7525', spanB: '219.9350'},
        {base: '223.4050', conversion: '222.1000', spanA: '222.7525', spanB: '219.9350'},
        {base: '223.4050', conversion: '222.5100', spanA: '222.9575', spanB: '219.9350'},
        {base: '223.0550', conversion: '222.5100', spanA: '222.7825', spanB: '220.4050'},
        {base: '222.9900', conversion: '223.2350', spanA: '223.1125', spanB: '220.4300'},
        {base: '222.9900', conversion: '223.6000', spanA: '223.2950', spanB: '220.4300'},
        {base: '222.9900', conversion: '223.3300', spanA: '223.1600', spanB: '220.4300'},
        {base: '222.9900', conversion: '223.3300', spanA: '223.1600', spanB: '220.4300'},
      ] as const;
      const ichimoku = new IchimokuCloud();
      const offset = ichimoku.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = ichimoku.add(candle);

        if (result) {
          expect({
            base: result.base.toFixed(4),
            conversion: result.conversion.toFixed(4),
            spanA: result.spanA.toFixed(4),
            spanB: result.spanB.toFixed(4),
          }).toEqual(expectations[i - offset]);
        }
      });

      expect(ichimoku.isStable).toBe(true);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const ichimoku = new IchimokuCloud({baseInterval: 3, conversionInterval: 2, spanBInterval: 4});

      ichimoku.add({high: 20, low: 2});
      ichimoku.add({high: 16, low: 6});
      ichimoku.add({high: 11, low: 7});
      ichimoku.add({high: 10, low: 8});

      // A candle spanning 5 to 30 dominates every window, so all lines meet at its midpoint 17.5
      const originalCandle = {high: 30, low: 5} as const;
      const replacementCandle = {high: 9, low: 3} as const;

      const originalResult = ichimoku.add(originalCandle);

      expect(originalResult).toEqual({base: 17.5, conversion: 17.5, spanA: 17.5, spanB: 17.5});

      const replacedResult = ichimoku.replace(replacementCandle);

      expect(replacedResult).toEqual({base: 7, conversion: 6.5, spanA: 6.75, spanB: 9.5});

      const restoredResult = ichimoku.replace(originalCandle);

      expect(restoredResult).toEqual(originalResult);
    });
  });
});

testIndicatorContract({
  create: () => new IchimokuCloud({baseInterval: 3, conversionInterval: 2, spanBInterval: 4}),
  divergentInput: {high: 500, low: 1},
  inputs: [
    {high: 20, low: 2},
    {high: 16, low: 6},
    {high: 11, low: 7},
    {high: 10, low: 8},
    {high: 9, low: 5},
  ],
});
