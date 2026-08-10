import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {VortexIndicator} from './VortexIndicator.js';
import {TradingSignal} from '../../base/index.js';

describe('VortexIndicator', () => {
  describe('update', () => {
    it('relates each candle to the previous one and normalizes both movement sums by the total true range', () => {
      /*
       * Formula (Etienne Botes & Douglas Siepman, "The Vortex Indicator",
       * Technical Analysis of Stocks & Commodities, January 2010):
       * VM+ = |High - Previous Low|, VM- = |Low - Previous High|
       * VI+ = Sum(VM+) / Sum(TR), VI- = Sum(VM-) / Sum(TR) over the interval
       * https://school.stockcharts.com/doku.php?id=technical_indicators:vortex_indicator
       *
       * The expectations below are derived by hand with interval 2:
       *
       * | Bar | High | Low | Close | VM+ | VM- | TR | VI+         | VI-         |
       * |-----|------|-----|-------|-----|-----|----|-------------|-------------|
       * | 1   | 12   | 8   | 10    | -   | -   | -  | -           | -           |
       * | 2   | 14   | 10  | 12    | 6   | 2   | 4  | -           | -           |
       * | 3   | 16   | 12  | 14    | 6   | 2   | 4  | 12/8 = 1.5  | 4/8 = 0.5   |
       * | 4   | 15   | 11  | 12    | 3   | 5   | 4  | 9/8 = 1.125 | 7/8 = 0.875 |
       */
      const candles = [
        {close: 10, high: 12, low: 8},
        {close: 12, high: 14, low: 10},
        {close: 14, high: 16, low: 12},
        {close: 12, high: 15, low: 11},
      ] as const;
      const expectations = [
        {minus: 0.5, plus: 1.5},
        {minus: 0.875, plus: 1.125},
      ] as const;
      const vortex = new VortexIndicator(2);
      const offset = vortex.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = vortex.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(vortex.isStable).toBe(true);
    });

    it('matches the Skender.Stock.Indicators reference results', () => {
      /*
       * The expectations are the Skender.Stock.Indicators v3.0.0 baseline for VI(14) over the
       * first 30 candles of its default test quotes. The Vortex Indicator only ever looks back
       * one interval, so a leading slice of the series yields the same results as a full run.
       *
       * Quotes: https://raw.githubusercontent.com/facioquo/stock-indicators-dotnet/3.0.0/tests/indicators/_testdata/quotes/default.csv
       * Results: https://raw.githubusercontent.com/facioquo/stock-indicators-dotnet/3.0.0/tests/indicators/_testdata/results/vortex.standard.json
       */
      const candles = [
        {close: 212.8, high: 213.35, low: 211.52},
        {close: 214.06, high: 214.22, low: 213.15},
        {close: 213.89, high: 214.06, low: 213.02},
        {close: 214.66, high: 215.17, low: 213.42},
        {close: 213.95, high: 214.53, low: 213.91},
        {close: 213.95, high: 214.89, low: 213.52},
        {close: 214.55, high: 214.55, low: 213.13},
        {close: 214.02, high: 214.22, low: 212.53},
        {close: 214.51, high: 214.84, low: 214.17},
        {close: 213.75, high: 214.25, low: 213.33},
        {close: 214.22, high: 214.27, low: 213.42},
        {close: 213.43, high: 214.46, low: 212.96},
        {close: 214.21, high: 214.75, low: 213.49},
        {close: 213.66, high: 214.28, low: 212.83},
        {close: 215.03, high: 215.48, low: 213.77},
        {close: 216.89, high: 216.89, low: 215.89},
        {close: 216.66, high: 217.02, low: 216.36},
        {close: 216.32, high: 216.91, low: 216.12},
        {close: 214.98, high: 215.59, low: 213.9},
        {close: 214.96, high: 215.03, low: 213.82},
        {close: 215.05, high: 215.96, low: 214.4},
        {close: 215.19, high: 215.5, low: 214.29},
        {close: 216.67, high: 216.87, low: 215.84},
        {close: 216.28, high: 216.66, low: 215.92},
        {close: 216.29, high: 216.97, low: 216.09},
        {close: 216.58, high: 216.72, low: 215.7},
        {close: 217.86, high: 218.19, low: 216.84},
        {close: 218.72, high: 218.97, low: 217.88},
        {close: 219.91, high: 220.19, low: 219.23},
        {close: 220.79, high: 220.8, low: 219.33},
      ] as const;
      const expectations = [
        {minus: '0.8119', plus: '1.0460'},
        {minus: '0.8042', plus: '1.0439'},
        {minus: '0.7848', plus: '1.0767'},
        {minus: '0.8417', plus: '1.0449'},
        {minus: '0.8593', plus: '0.9256'},
        {minus: '0.9058', plus: '0.9410'},
        {minus: '0.8412', plus: '0.9913'},
        {minus: '0.8590', plus: '1.0349'},
        {minus: '0.8360', plus: '1.0031'},
        {minus: '0.8255', plus: '1.0645'},
        {minus: '0.8106', plus: '1.0686'},
        {minus: '0.8293', plus: '1.0741'},
        {minus: '0.7717', plus: '1.0946'},
        {minus: '0.6991', plus: '1.1868'},
        {minus: '0.6988', plus: '1.1909'},
        {minus: '0.7393', plus: '1.1300'},
      ] as const;
      const vortex = new VortexIndicator(14);
      const offset = vortex.getRequiredInputs() - 1;
      let verifiedBars = 0;

      candles.forEach((candle, i) => {
        const result = vortex.add(candle);

        if (result) {
          verifiedBars++;
          const expected = expectations[i - offset];
          expect(result.minus.toFixed(4)).toBe(expected.minus);
          expect(result.plus.toFixed(4)).toBe(expected.plus);
        }
      });

      expect(verifiedBars).toBe(expectations.length);
    });

    it('reports zero on both lines when the whole window shows no true range', () => {
      const vortex = new VortexIndicator(2);

      vortex.add({close: 10, high: 10, low: 10});
      vortex.add({close: 10, high: 10, low: 10});
      vortex.add({close: 10, high: 10, low: 10});

      expect(vortex.getResultOrThrow()).toEqual({minus: 0, plus: 0});
      expect(vortex.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('stays sideways when the price freezes right after a wide candle', () => {
      /*
       * Every candle in the window is flat at the previous close, so the market never moved,
       * yet the wide candle just before the window skews the raw movement sums to the downside
       * (VM+ = 5 vs. VM- = 10). A frozen market must not fabricate a direction from that skew.
       */
      const vortex = new VortexIndicator(2);

      vortex.add({close: 10, high: 20, low: 5});
      vortex.add({close: 10, high: 10, low: 10});
      vortex.add({close: 10, high: 10, low: 10});

      expect(vortex.getResultOrThrow()).toEqual({minus: 0, plus: 0});
      expect(vortex.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('getRequiredInputs', () => {
    it('needs one candle more than the interval, which defaults to 14 periods', () => {
      expect(new VortexIndicator().getRequiredInputs()).toBe(15);
      expect(new VortexIndicator(2).getRequiredInputs()).toBe(3);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const vortex = new VortexIndicator(2);

      vortex.add({close: 10, high: 12, low: 8});
      vortex.add({close: 12, high: 14, low: 10});
      vortex.add({close: 14, high: 16, low: 12});

      const originalCandle = {close: 12, high: 15, low: 11} as const;
      const replacementCandle = {close: 18, high: 20, low: 16} as const;

      const originalResult = vortex.add(originalCandle);

      expect(originalResult).toEqual({minus: 0.875, plus: 1.125});

      const replacedResult = vortex.replace(replacementCandle);

      expect(replacedResult).toEqual({minus: 0.2, plus: 1.4});

      const restoredResult = vortex.replace(originalCandle);

      expect(restoredResult).toEqual({minus: 0.875, plus: 1.125});
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const vortex = new VortexIndicator(2);

      expect(vortex.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});

      vortex.add({close: 10, high: 11, low: 9});
      vortex.add({close: 10, high: 11, low: 9});

      expect(vortex.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH when the upward movement line trades above the downward one', () => {
      const vortex = new VortexIndicator(2);

      vortex.add({close: 10, high: 12, low: 8});
      vortex.add({close: 12, high: 14, low: 10});
      vortex.add({close: 14, high: 16, low: 12});

      expect(vortex.getResultOrThrow()).toEqual({minus: 0.5, plus: 1.5});
      expect(vortex.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the downward movement line trades above the upward one', () => {
      const vortex = new VortexIndicator(2);

      vortex.add({close: 14, high: 16, low: 12});
      vortex.add({close: 12, high: 14, low: 10});
      vortex.add({close: 10, high: 12, low: 8});

      expect(vortex.getResultOrThrow()).toEqual({minus: 1.5, plus: 0.5});
      expect(vortex.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when both lines are equal', () => {
      /*
       * Identical candles with a real trading range push both lines to exactly 1: every
       * high-to-previous-low reach equals the low-to-previous-high reach, so neither side
       * gains an edge even though the market is moving.
       */
      const vortex = new VortexIndicator(2);

      vortex.add({close: 10, high: 11, low: 9});
      vortex.add({close: 10, high: 11, low: 9});
      vortex.add({close: 10, high: 11, low: 9});

      expect(vortex.getResultOrThrow()).toEqual({minus: 1, plus: 1});
      expect(vortex.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags a change only when the signal switches its state', () => {
      const vortex = new VortexIndicator(2);

      vortex.add({close: 10, high: 11, low: 9});
      vortex.add({close: 10, high: 11, low: 9});
      vortex.add({close: 10, high: 11, low: 9});

      expect(vortex.getSignal()).toEqual({hasChanged: true, state: TradingSignal.SIDEWAYS});

      vortex.add({close: 18, high: 20, low: 14});

      expect(vortex.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});

      vortex.add({close: 24, high: 26, low: 20});

      expect(vortex.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});
    });
  });
});

testIndicatorContract({
  create: () => new VortexIndicator(2),
  divergentInput: {close: 1_000, high: 1_010, low: 990},
  inputs: [
    {close: 10, high: 12, low: 8},
    {close: 12, high: 14, low: 10},
    {close: 14, high: 16, low: 12},
    {close: 12, high: 15, low: 11},
  ],
});
