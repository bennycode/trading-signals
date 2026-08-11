import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {CHOP} from './CHOP.js';

describe('CHOP', () => {
  describe('constructor', () => {
    it("uses E.W. Dreiss' 14-period window by default", () => {
      const chop = new CHOP();

      expect(chop.interval).toBe(14);
      expect(chop.getRequiredInputs()).toBe(15);
    });

    it('rejects a window whose logarithm cannot normalize the reading', () => {
      expect(() => new CHOP(1)).toThrowError('The interval has to be at least 2, but "1" was given.');
      expect(() => new CHOP(0)).toThrowError('The interval has to be at least 2, but "0" was given.');
    });
  });

  describe('getResultOrThrow', () => {
    it('matches the Skender.Stock.Indicators reference results', () => {
      /*
       * The expectations are the Skender.Stock.Indicators v3.0.0 baseline for the Choppiness Index (14)
       * over the first 32 candles of its default test quotes. The Choppiness Index only ever looks back
       * one window plus the close seeding the first true range, so a leading slice of the series yields
       * the same results as a full run.
       *
       * Quotes: https://raw.githubusercontent.com/facioquo/stock-indicators-dotnet/3.0.0/tests/indicators/_testdata/quotes/default.csv
       * Results: https://raw.githubusercontent.com/facioquo/stock-indicators-dotnet/3.0.0/tests/indicators/_testdata/results/chop.standard.json
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
        {close: 221.94, high: 222.15, low: 220.5},
        {close: 221.75, high: 222.16, low: 220.93},
      ] as const;
      const expectations = [
        '69.9966973',
        '56.0742141',
        '54.2014428',
        '52.2121054',
        '55.6083257',
        '55.2958100',
        '55.5694019',
        '56.5787410',
        '58.2869649',
        '57.4424782',
        '57.5020106',
        '56.5380840',
        '47.7918981',
        '47.4598973',
        '39.8426024',
        '35.5579320',
        '30.9045157',
        '31.7342961',
      ] as const;
      const chop = new CHOP();
      const offset = chop.getRequiredInputs() - 1;
      let verifiedCandles = 0;

      candles.forEach((candle, i) => {
        const result = chop.add(candle);

        if (result !== null) {
          verifiedCandles++;
          expect(result.toFixed(7)).toBe(expectations[i - offset]);
        }
      });

      expect(verifiedCandles).toBe(expectations.length);
    });

    it('counts a gap in both the path and the window span', () => {
      /*
       * Hand-derived reference for a 2-bar window with a gap down. The first candle only seeds the close
       * that the next true range extends to:
       *
       * candle             | true high        | true low         | true range
       * (120, 118, c 119)  | —                | —                | — (seeds close 119)
       * (110, 105, c 106)  | max(110,119)=119 | min(105,119)=105 | 14
       * (108, 104, c 107)  | max(108,106)=108 | min(104,106)=104 | 4
       *
       * Path = 14 + 4 = 18; span = 119 − 104 = 15
       * CHOP = 100 × log10(18/15) / log10(2) ≈ 26.3034
       *
       * Reading the span off the printed highs and lows instead (110 − 104 = 6) would count the gap in the
       * path but not in the span and read 100 × log10(18/6) / log10(2) ≈ 158.4963 — beyond the 0–100 scale.
       */
      const candles = [
        {close: 119, high: 120, low: 118},
        {close: 106, high: 110, low: 105},
        {close: 107, high: 108, low: 104},
      ] as const;
      const chop = new CHOP(2);

      for (const candle of candles) {
        chop.add(candle);
      }

      expect(chop.getResultOrThrow()).toBe(26.30344058337938);
    });

    it('reads a dead-flat window as maximal choppiness', () => {
      // Without a span there is no path either, and the limit of same-centered shrinking candles reads 100
      const chop = new CHOP(3);

      for (let i = 0; i < 4; i++) {
        chop.add({close: 100, high: 100, low: 100});
      }

      expect(chop.getResultOrThrow()).toBe(100);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added candle', () => {
      const chop = new CHOP(2);
      const candles = [
        {close: 119, high: 120, low: 118},
        {close: 106, high: 110, low: 105},
        {close: 107, high: 108, low: 104},
      ] as const;

      for (const candle of candles) {
        chop.add(candle);
      }

      expect(chop.getResultOrThrow()).toBe(26.30344058337938);

      // Window spans 104 to 112 with a path of 6 + 4 = 10 → 100 × log10(10/8) / log10(2)
      const originalCandle = {close: 111, high: 112, low: 106} as const;
      // Window spans 103 to 109 with the same path of 10 → 100 × log10(10/6) / log10(2)
      const replacementCandle = {close: 104, high: 109, low: 103} as const;

      const originalResult = chop.add(originalCandle);

      expect(originalResult).toBe(32.19280948873624);

      const replacedResult = chop.replace(replacementCandle);

      expect(replacedResult).toBe(73.69655941662062);

      const restoredResult = chop.replace(originalCandle);

      expect(restoredResult).toBe(originalResult);
    });

    it('replaces the seed candle before the first true range exists', () => {
      const seedReplacement = {close: 110, high: 111, low: 109} as const;
      const candles = [
        {close: 106, high: 110, low: 105},
        {close: 107, high: 108, low: 104},
      ] as const;

      const replaced = new CHOP(2);
      replaced.add({close: 119, high: 120, low: 118});
      replaced.replace(seedReplacement);

      const reference = new CHOP(2);
      reference.add(seedReplacement);

      for (const candle of candles) {
        replaced.add(candle);
        reference.add(candle);
      }

      expect(replaced.getResultOrThrow()).toBe(reference.getResultOrThrow());
      expect(replaced.getResultOrThrow()).toBe(58.496250072115615);
    });
  });
});

testIndicatorContract({
  create: () => new CHOP(5),
  divergentInput: {close: 500, high: 1000, low: 10},
  inputs: [
    {close: 212.8, high: 213.35, low: 211.52},
    {close: 214.06, high: 214.22, low: 213.15},
    {close: 213.89, high: 214.06, low: 213.02},
    {close: 214.66, high: 215.17, low: 213.42},
    {close: 213.95, high: 214.53, low: 213.91},
    {close: 213.95, high: 214.89, low: 213.52},
    {close: 214.55, high: 214.55, low: 213.13},
  ],
});
