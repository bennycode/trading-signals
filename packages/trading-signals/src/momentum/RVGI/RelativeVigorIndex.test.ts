import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {RelativeVigorIndex} from './RelativeVigorIndex.js';
import {TradingSignal} from '../../base/index.js';

describe('RelativeVigorIndex', () => {
  describe('update', () => {
    it('measures how much of the smoothed trading range the closes captured over the interval', () => {
      /*
       * Formula (John Ehlers, "Relative Vigor Index",
       * Technical Analysis of Stocks & Commodities, January 2002):
       * NUM = (a + 2b + 2c + d) / 6 over the candle bodies (Close - Open), with "a" the current bar
       * DEN = the same weighting over the candle ranges (High - Low)
       * RVGI = SMA(NUM) / SMA(DEN) over the interval
       * Signal = (RVGI + 2 * RVGI[1] + 2 * RVGI[2] + RVGI[3]) / 6
       * https://www.tradingview.com/support/solutions/43000591593-relative-vigor-index/
       *
       * The expectations below are derived by hand with interval 2. Every candle spans the range
       * 10 to 11, so DEN is always 1 and RVGI reduces to the average of the last two NUM values.
       * The bodies are engineered so that every weighted sum divides into an exact binary fraction:
       *
       * | Bar | Open  | Close | Body | NUM   | RVGI   | Signal |
       * |-----|-------|-------|------|-------|--------|--------|
       * | 1   | 10.5  | 10.5  |  0   | -     | -      | -      |
       * | 2   | 10    | 11    |  1   | -     | -      | -      |
       * | 3   | 10.25 | 10.75 |  0.5 | -     | -      | -      |
       * | 4   | 10.5  | 10.5  |  0   |  0.5  | -      | -      |
       * | 5   | 10.75 | 10.25 | -0.5 |  0.25 |  0.375 | -      |
       * | 6   | 11    | 10    | -1   | -0.25 |  0     | -      |
       * | 7   | 10.5  | 10.5  |  0   | -0.5  | -0.375 | -      |
       * | 8   | 10    | 11    |  1   | -0.25 | -0.375 | -0.125 |
       * | 9   | 10.25 | 10.75 |  0.5 |  0.25 |  0     | -0.25  |
       */
      const candles = [
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 11, high: 11, low: 10, open: 10},
        {close: 10.75, high: 11, low: 10, open: 10.25},
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 10.25, high: 11, low: 10, open: 10.75},
        {close: 10, high: 11, low: 10, open: 11},
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 11, high: 11, low: 10, open: 10},
        {close: 10.75, high: 11, low: 10, open: 10.25},
      ] as const;
      const expectations = [
        {rvgi: -0.375, signal: -0.125},
        {rvgi: 0, signal: -0.25},
      ] as const;
      const rvgi = new RelativeVigorIndex(2);
      const offset = rvgi.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = rvgi.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(rvgi.isStable).toBe(true);
    });

    it('matches the QuantConnect LEAN reference results', () => {
      /*
       * The expectations are the "RVI" and "RVI_S" columns of QuantConnect LEAN's reference data
       * for RVI(10) over the first 30 candles of its SPY test file. The index only ever looks back
       * one interval plus the smoothing bars, so a leading slice of the series yields the same
       * results as a full run. The file carries no signal value for the first two stable bars
       * because its export warmed the signal line up separately.
       *
       * https://raw.githubusercontent.com/QuantConnect/Lean/7531046f143b373f1ae865305a90bb118af2bb7c/Tests/TestData/spy_rvi.txt
       */
      const candles = [
        {close: 292.4, high: 293.57, low: 290.99, open: 291.39},
        {close: 293.06, high: 293.65, low: 291.47, open: 292.55},
        {close: 295.86, high: 296.3093, low: 293.1255, open: 296.04},
        {close: 294, high: 295.52, low: 293.76, open: 294.13},
        {close: 293.64, high: 294.58, low: 293.47, open: 294.23},
        {close: 290.76, high: 293.73, low: 290.64, open: 293.7},
        {close: 290.47, high: 292.31, low: 290.345, open: 291.75},
        {close: 291.5, high: 292.06, low: 290.89, open: 291.31},
        {close: 293, high: 293.55, low: 292.01, open: 292.58},
        {close: 295.66, high: 296.92, low: 294.33, open: 296.68},
        {close: 296.43, high: 296.49, low: 294.68, open: 295.61},
        {close: 298.8, high: 298.82, low: 297.02, open: 297.18},
        {close: 298.46, high: 298.64, low: 296.01, open: 297.44},
        {close: 296.82, high: 298.2579, low: 296.22, open: 297.01},
        {close: 297.19, high: 297.52, low: 295.48, open: 295.54},
        {close: 298.61, high: 299.66, low: 297.78, open: 298.37},
        {close: 299.31, high: 299.58, low: 298.2, open: 299.32},
        {close: 300.65, high: 300.73, low: 299.51, open: 299.85},
        {close: 300.75, high: 301.13, low: 300.19, open: 301.13},
        {close: 299.71, high: 300.88, low: 299.44, open: 300.65},
        {close: 297.74, high: 299.93, low: 297.74, open: 299.75},
        {close: 298.83, high: 299.25, low: 296.7, open: 297.19},
        {close: 297.17, high: 300.07, low: 296.96, open: 300.04},
        {close: 297.9, high: 298.5, low: 297.04, open: 297.61},
        {close: 300.03, high: 300.03, low: 298.22, open: 299.14},
        {close: 301.44, high: 301.44, low: 299.09, open: 299.19},
        {close: 300, high: 301, low: 299.11, open: 300.94},
        {close: 302.01, high: 302.23, low: 300.62, open: 300.76},
        {close: 301.46, high: 301.93, low: 300.85, open: 301.88},
        {close: 300.72, high: 301.17, low: 299.49, open: 299.91},
      ] as const;
      const expectations = [
        {rvgi: '-0.01452912', signal: null},
        {rvgi: '0.08671707', signal: null},
        {rvgi: '0.18971057', signal: '0.04101645'},
        {rvgi: '0.24867199', signal: '0.13116636'},
        {rvgi: '0.26382098', signal: '0.20455053'},
        {rvgi: '0.23730807', signal: '0.24200076'},
        {rvgi: '0.18123147', signal: '0.23869359'},
        {rvgi: '0.09099570', signal: '0.19864929'},
        {rvgi: '-0.00263733', signal: '0.12985418'},
        {rvgi: '-0.07118006', signal: '0.04779469'},
        {rvgi: '-0.09387153', signal: '-0.02508510'},
        {rvgi: '-0.07488867', signal: '-0.06793820'},
        {rvgi: '-0.05697726', signal: '-0.07761295'},
        {rvgi: '-0.04696229', signal: '-0.06742761'},
        {rvgi: '-0.03213887', signal: '-0.05248444'},
      ] as const;
      const rvgi = new RelativeVigorIndex(10);
      const offset = rvgi.getRequiredInputs() - 1;
      let verifiedBars = 0;

      candles.forEach((candle, i) => {
        const result = rvgi.add(candle);

        if (result) {
          verifiedBars++;
          const expected = expectations[i - offset];
          expect(result.rvgi.toFixed(8)).toBe(expected.rvgi);

          if (expected.signal !== null) {
            expect(result.signal.toFixed(8)).toBe(expected.signal);
          }
        }
      });

      expect(verifiedBars).toBe(expectations.length);
    });

    it('reports zero vigor when every candle in the window is flat', () => {
      /*
       * Flat candles offer no trading range that the closes could capture, so there is no vigor
       * to measure. Zero on both lines keeps a dead market sideways instead of fabricating a
       * direction from a division by zero.
       */
      const rvgi = new RelativeVigorIndex(1);

      for (let i = 0; i < 7; i++) {
        rvgi.add({close: 10, high: 10, low: 10, open: 10});
      }

      expect(rvgi.getResultOrThrow()).toEqual({rvgi: 0, signal: 0});
      expect(rvgi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('getRequiredInputs', () => {
    it('needs six candles more than the interval, which defaults to 10 periods', () => {
      expect(new RelativeVigorIndex().getRequiredInputs()).toBe(16);
      expect(new RelativeVigorIndex(2).getRequiredInputs()).toBe(8);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const candles = [
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 11, high: 11, low: 10, open: 10},
        {close: 10.75, high: 11, low: 10, open: 10.25},
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 10.25, high: 11, low: 10, open: 10.75},
        {close: 10, high: 11, low: 10, open: 11},
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 11, high: 11, low: 10, open: 10},
      ] as const;
      const rvgi = new RelativeVigorIndex(2);

      for (const candle of candles) {
        rvgi.add(candle);
      }

      const originalCandle = {close: 10.75, high: 11, low: 10, open: 10.25} as const;
      const replacementCandle = {close: 8.5, high: 18, low: 5, open: 17} as const;

      const originalResult = rvgi.add(originalCandle);

      expect(originalResult).toEqual({rvgi: 0, signal: -0.25});

      const replacedResult = rvgi.replace(replacementCandle);

      expect(replacedResult).toEqual({rvgi: -0.375, signal: -0.3125});

      const restoredResult = rvgi.replace(originalCandle);

      expect(restoredResult).toEqual({rvgi: 0, signal: -0.25});
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const rvgi = new RelativeVigorIndex(1);

      expect(rvgi.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});

      rvgi.add({close: 10.75, high: 11, low: 10, open: 10.25});
      rvgi.add({close: 10.75, high: 11, low: 10, open: 10.25});

      expect(rvgi.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH when the index trades above its signal line', () => {
      const candles = [
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 11, high: 11, low: 10, open: 10},
        {close: 10.75, high: 11, low: 10, open: 10.25},
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 10.25, high: 11, low: 10, open: 10.75},
        {close: 10, high: 11, low: 10, open: 11},
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 11, high: 11, low: 10, open: 10},
        {close: 10.75, high: 11, low: 10, open: 10.25},
      ] as const;
      const rvgi = new RelativeVigorIndex(2);

      for (const candle of candles) {
        rvgi.add(candle);
      }

      expect(rvgi.getResultOrThrow()).toEqual({rvgi: 0, signal: -0.25});
      expect(rvgi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the index trades below its signal line', () => {
      const candles = [
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 11, high: 11, low: 10, open: 10},
        {close: 10.75, high: 11, low: 10, open: 10.25},
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 10.25, high: 11, low: 10, open: 10.75},
        {close: 10, high: 11, low: 10, open: 11},
        {close: 10.5, high: 11, low: 10, open: 10.5},
        {close: 11, high: 11, low: 10, open: 10},
      ] as const;
      const rvgi = new RelativeVigorIndex(2);

      for (const candle of candles) {
        rvgi.add(candle);
      }

      expect(rvgi.getResultOrThrow()).toEqual({rvgi: -0.375, signal: -0.125});
      expect(rvgi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the index sits exactly on its signal line', () => {
      /*
       * Identical bullish candles push the index and its smoothed copy to the same constant, so
       * neither line gains an edge even though the market keeps closing above its open.
       */
      const rvgi = new RelativeVigorIndex(1);

      for (let i = 0; i < 7; i++) {
        rvgi.add({close: 10.75, high: 11, low: 10, open: 10.25});
      }

      expect(rvgi.getResultOrThrow()).toEqual({rvgi: 0.5, signal: 0.5});
      expect(rvgi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags a change only when the signal switches its state', () => {
      const rvgi = new RelativeVigorIndex(1);

      for (let i = 0; i < 7; i++) {
        rvgi.add({close: 10.75, high: 11, low: 10, open: 10.25});
      }

      expect(rvgi.getSignal()).toEqual({hasChanged: true, state: TradingSignal.SIDEWAYS});

      rvgi.add({close: 11, high: 11, low: 10, open: 10});

      expect(rvgi.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});

      rvgi.add({close: 11, high: 11, low: 10, open: 10});

      expect(rvgi.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});
    });
  });
});

testIndicatorContract({
  create: () => new RelativeVigorIndex(2),
  divergentInput: {close: 8.5, high: 18, low: 5, open: 17},
  inputs: [
    {close: 10.5, high: 11, low: 10, open: 10.5},
    {close: 11, high: 11, low: 10, open: 10},
    {close: 10.75, high: 11, low: 10, open: 10.25},
    {close: 10.5, high: 11, low: 10, open: 10.5},
    {close: 10.25, high: 11, low: 10, open: 10.75},
    {close: 10, high: 11, low: 10, open: 11},
    {close: 10.5, high: 11, low: 10, open: 10.5},
    {close: 11, high: 11, low: 10, open: 10},
    {close: 10.75, high: 11, low: 10, open: 10.25},
  ],
});
