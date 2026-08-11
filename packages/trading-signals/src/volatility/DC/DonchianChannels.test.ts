import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {DonchianChannels} from './DonchianChannels.js';

describe('DonchianChannels', () => {
  describe('constructor', () => {
    it('uses an interval of 20 by default', () => {
      const dc = new DonchianChannels();

      expect(dc.interval).toBe(20);
      expect(dc.getRequiredInputs()).toBe(20);
    });
  });

  describe('getResultOrThrow', () => {
    it('frames a small window with values readable straight from the inputs', () => {
      const dc = new DonchianChannels(3);

      dc.add({high: 10, low: 8});
      dc.add({high: 12, low: 9});

      expect(dc.add({high: 11, low: 7})).toEqual({lower: 7, middle: 9.5, upper: 12});
    });

    it('drops an old extreme once it slides out of the window', () => {
      const dc = new DonchianChannels(3);

      dc.add({high: 100, low: 1});
      dc.add({high: 10, low: 8});

      expect(dc.add({high: 11, low: 9}), 'the extreme candle still dominates both bands').toEqual({
        lower: 1,
        middle: 50.5,
        upper: 100,
      });

      expect(dc.add({high: 12, low: 7}), 'the extreme candle no longer counts').toEqual({
        lower: 7,
        middle: 9.5,
        upper: 12,
      });
    });

    it('is compatible with results from Skender.Stock.Indicators', () => {
      /*
       * Test data verified with Skender.Stock.Indicators v3.0.0:
       * https://github.com/DaveSkender/Stock.Indicators/blob/3.0.0/tests/indicators/_testdata/quotes/default.csv (first 40 rows)
       * https://github.com/DaveSkender/Stock.Indicators/blob/3.0.0/tests/indicators/_testdata/results/donchian.standard.json (array indices 20-40, zero-based)
       *
       * Skender builds the channel from the candles preceding the current one
       * (https://github.com/DaveSkender/Stock.Indicators/blob/3.0.0/src/a-d/Donchian/Donchian.StaticSeries.cs#L39),
       * while the classic definition includes the current candle. Both cover the same window one candle apart, so
       * the expectations below are Skender's values shifted back by one candle. All values match exactly.
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
      ] as const;

      const expectations = [
        {lower: 211.52, middle: 214.27, upper: 217.02},
        {lower: 212.53, middle: 214.775, upper: 217.02},
        {lower: 212.53, middle: 214.775, upper: 217.02},
        {lower: 212.53, middle: 214.775, upper: 217.02},
        {lower: 212.53, middle: 214.775, upper: 217.02},
        {lower: 212.53, middle: 214.775, upper: 217.02},
        {lower: 212.53, middle: 214.775, upper: 217.02},
        {lower: 212.53, middle: 215.36, upper: 218.19},
        {lower: 212.83, middle: 215.9, upper: 218.97},
        {lower: 212.83, middle: 216.51, upper: 220.19},
        {lower: 212.83, middle: 216.815, upper: 220.8},
        {lower: 212.83, middle: 217.49, upper: 222.15},
        {lower: 212.83, middle: 217.495, upper: 222.16},
        {lower: 212.83, middle: 217.495, upper: 222.16},
        {lower: 213.77, middle: 218.695, upper: 223.62},
        {lower: 213.82, middle: 218.72, upper: 223.62},
        {lower: 213.82, middle: 218.815, upper: 223.81},
        {lower: 213.82, middle: 218.815, upper: 223.81},
        {lower: 213.82, middle: 219.01, upper: 224.2},
        {lower: 213.82, middle: 219.01, upper: 224.2},
        {lower: 214.29, middle: 220.665, upper: 227.04},
      ] as const;

      const dc = new DonchianChannels(20);
      const offset = dc.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = dc.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(dc.isStable).toBe(true);
    });
  });

  describe('update', () => {
    it('replaces the most recently added candle', () => {
      const dc = new DonchianChannels(3);

      dc.add({high: 10, low: 8});
      dc.add({high: 12, low: 9});

      const originalCandle = {high: 11, low: 7} as const;
      const replacedCandle = {high: 20, low: 9} as const;

      const originalResult = dc.add(originalCandle);

      expect(originalResult).toEqual({lower: 7, middle: 9.5, upper: 12});

      const replacedResult = dc.replace(replacedCandle);

      expect(replacedResult, 'the replaced candle sets a new high and retires the old low').toEqual({
        lower: 8,
        middle: 14,
        upper: 20,
      });

      const restoredResult = dc.replace(originalCandle);

      expect(restoredResult, 'replacing back reproduces the original channel').toEqual({
        lower: 7,
        middle: 9.5,
        upper: 12,
      });
    });
  });
});

testIndicatorContract({
  create: () => new DonchianChannels(5),
  divergentInput: {high: 1_000, low: 500},
  inputs: [
    {high: 213.35, low: 211.52},
    {high: 214.22, low: 213.15},
    {high: 214.06, low: 213.02},
    {high: 215.17, low: 213.42},
    {high: 214.53, low: 213.91},
    {high: 214.89, low: 213.52},
  ],
});
