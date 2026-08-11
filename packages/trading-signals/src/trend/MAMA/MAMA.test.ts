import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {MAMA, type MAMAResult} from './MAMA.js';
import {TradingSignal} from '../../base/index.js';

/*
 * Median prices ((high + low) / 2) of the official 252-bar daily series that TA-Lib ships with its
 * regression suite. TA-Lib's own MAMA regression run transforms the candles into exactly this
 * median price series before feeding them ("it is an AVGPRICE in John Ehlers book").
 *
 * Data: https://github.com/TA-Lib/ta-lib/blob/main/src/tools/ta_regtest/test_data.c
 * Setup: https://github.com/TA-Lib/ta-lib/blob/main/src/tools/ta_regtest/ta_test_func/test_ma.c
 */
const TALIB_MEDIAN_PRICES = [
  92, 93.1725, 95.3125, 94.845, 94.4075, 94.11, 93.5, 91.735, 90.955, 91.6875, 94.5, 97.97, 97.5775, 90.7825, 89.0325,
  92.095, 91.155, 89.7175, 90.61, 91, 88.9225, 87.515, 86.4375, 83.89, 83.0025, 82.8125, 82.845, 86.735, 86.86, 87.5475,
  85.78, 86.1725, 86.4375, 87.25, 88.9375, 88.205, 85.8125, 84.595, 83.6575, 84.455, 83.5, 86.7825, 88.1725, 89.265,
  90.86, 90.7825, 91.86, 90.36, 89.86, 90.9225, 89.5, 87.6725, 86.5, 84.2825, 82.9075, 84.25, 85.6875, 86.61, 88.2825,
  89.5325, 89.5, 88.095, 90.625, 92.235, 91.6725, 92.5925, 93.015, 91.1725, 90.985, 90.3775, 88.25, 86.9075, 84.0925,
  83.1875, 84.2525, 97.86, 99.875, 103.265, 105.9375, 103.5, 103.11, 103.61, 104.64, 106.815, 104.9525, 105.5, 107.14,
  109.735, 109.845, 110.985, 120, 119.875, 117.9075, 119.4075, 117.9525, 117.22, 115.6425, 113.11, 111.75, 114.5175,
  114.745, 115.47, 112.53, 112.03, 113.435, 114.22, 119.595, 117.965, 118.715, 115.03, 114.53, 115, 116.53, 120.185,
  120.5, 120.595, 124.185, 125.375, 122.97, 123, 124.435, 123.44, 124.03, 128.185, 129.655, 130.875, 132.345, 132.065,
  133.815, 135.66, 137.035, 137.47, 137.345, 136.315, 136.44, 136.285, 129.095, 128.31, 126, 124.03, 123.935, 125.03,
  127.25, 125.62, 125.53, 123.905, 120.655, 119.965, 120.78, 124, 122.78, 120.72, 121.78, 122.405, 123.25, 126.185,
  127.56, 126.565, 123.06, 122.715, 123.59, 122.31, 122.465, 123.965, 123.97, 124.155, 124.435, 127, 125.5, 128.875,
  130.535, 132.315, 134.065, 136.035, 133.78, 132.75, 133.47, 130.97, 127.595, 128.44, 127.94, 125.81, 124.625, 122.72,
  124.09, 123.22, 121.405, 120.935, 118.28, 118.375, 121.155, 120.905, 117.125, 113.06, 114.905, 112.435, 107.935,
  105.97, 106.37, 106.845, 106.97, 110.03, 91, 93.56, 93.62, 95.31, 94.185, 94.78, 97.625, 97.59, 95.25, 94.72, 92.22,
  91.565, 92.22, 93.81, 95.59, 96.185, 94.625, 95.12, 94, 93.745, 95.905, 101.745, 106.44, 107.935, 103.405, 105.06,
  104.155, 103.31, 103.345, 104.84, 110.405, 114.5, 117.315, 118.25, 117.185, 109.75, 109.655, 108.53, 106.22, 107.72,
  109.84, 109.095, 109.09, 109.155, 109.315, 109.06, 109.905, 109.625, 109.53, 108.06,
] as const;

describe('MAMA', () => {
  describe('update', () => {
    it('reproduces the published TA-Lib regression values over its official test data', () => {
      /*
       * TA-Lib publishes the expected first and last values of a MAMA(0.5, 0.05) run over its
       * 252-bar regression data, along with the output placement (first value on bar 33,
       * 220 values in total):
       *
       * MAMA first: 85.3643, MAMA last: 110.1116
       * FAMA first: 81.88, FAMA last: 108.82
       *
       * https://github.com/TA-Lib/ta-lib/blob/main/src/tools/ta_regtest/ta_test_func/test_ma.c
       * (lines 145-151)
       */
      const mama = new MAMA();
      const results = [];

      for (const price of TALIB_MEDIAN_PRICES) {
        const result = mama.add(price);

        if (result) {
          results.push(result);
        }
      }

      expect(results.length).toBe(220);

      const first = results[0];
      const last = results[results.length - 1];

      expect(first.mama.toFixed(4)).toBe('85.3643');
      expect(first.fama.toFixed(2)).toBe('81.88');
      expect(last.mama.toFixed(4)).toBe('110.1116');
      expect(last.fama.toFixed(2)).toBe('108.82');
    });

    it('matches a line-by-line port of the TA-Lib reference implementation bar for bar', () => {
      /*
       * TA-Lib publishes only the first and last value of its MAMA regression run, so no full
       * reference sequence exists to copy. The expectations below come from a line-by-line
       * JavaScript port of TA-Lib's `ta_MAMA.c` — a port that reproduces all four published
       * regression values over the full 252-bar series (see the test above) — executed over the
       * first 60 median prices. The port keeps TA-Lib's even/odd circular Hilbert buffers while
       * this implementation uses the direct lag windows of Ehlers' original article (John Ehlers,
       * "MESA Adaptive Moving Averages", Technical Analysis of Stocks & Commodities, September
       * 2001): two independently structured implementations agreeing bar for bar is the
       * verification.
       */
      const prices = TALIB_MEDIAN_PRICES.slice(0, 60);
      const expectations = [
        {fama: '81.88465805', mama: '85.36425577'},
        {fama: '81.97400517', mama: '85.45854298'},
        {fama: '82.06546731', mama: '85.63249083'},
        {fama: '82.15785854', mama: '85.76111629'},
        {fama: '82.24800421', mama: '85.76368548'},
        {fama: '82.98083884', mama: '85.17934274'},
        {fama: '83.03389914', mama: '85.10325060'},
        {fama: '83.08482261', mama: '85.07083807'},
        {fama: '83.13250945', mama: '84.99229617'},
        {fama: '83.82123161', mama: '85.88739808'},
        {fama: '83.87574215', mama: '86.00165318'},
        {fama: '83.93296911', mama: '86.16482052'},
        {fama: '83.99463437', mama: '86.39957949'},
        {fama: '84.06023665', mama: '86.61872552'},
        {fama: '85.35501817', mama: '89.23936276'},
        {fama: '85.45352759', mama: '89.29539462'},
        {fama: '85.55028002', mama: '89.32362489'},
        {fama: '85.64661223', mama: '89.40356865'},
        {fama: '85.74065668', mama: '89.40839021'},
        {fama: '85.83018016', mama: '89.32159570'},
        {fama: '85.91393855', mama: '89.18051592'},
        {fama: '86.11833090', mama: '86.73150796'},
        {fama: '86.12888032', mama: '86.54030756'},
        {fama: '85.94544869', mama: '85.39515378'},
        {fama: '85.93205675', mama: '85.40977109'},
        {fama: '85.92049989', mama: '85.46978254'},
        {fama: '85.91274785', mama: '85.61041841'},
        {fama: '85.91009222', mama: '85.80652249'},
      ] as const;
      const mama = new MAMA();
      const offset = mama.getRequiredInputs() - 1;
      let verifiedBars = 0;

      prices.forEach((price, i) => {
        const result = mama.add(price);

        if (result) {
          verifiedBars++;
          const expected = expectations[i - offset];
          expect(result.mama.toFixed(8)).toBe(expected.mama);
          expect(result.fama.toFixed(8)).toBe(expected.fama);
        }
      });

      expect(verifiedBars).toBe(expectations.length);
    });

    it('moves faster and stalls slower within custom smoothing limits', () => {
      /*
       * Expectations derived from the same TA-Lib port with fastLimit 0.9 and slowLimit 0.02,
       * proving the limits are wired into the adaptive smoothing instead of the defaults.
       */
      const mama = new MAMA({fastLimit: 0.9, slowLimit: 0.02});
      const results = [];

      for (const price of TALIB_MEDIAN_PRICES.slice(0, 60)) {
        const result = mama.add(price);

        if (result) {
          results.push(result);
        }
      }

      const first = results[0];
      const last = results[results.length - 1];

      expect(first.mama.toFixed(8)).toBe('86.16493452');
      expect(first.fama.toFixed(8)).toBe('84.88020055');
      expect(last.mama.toFixed(8)).toBe('84.77229582');
      expect(last.fama.toFixed(8)).toBe('85.61075332');
    });

    it('follows a slow swing whose cycle is longer than the measurable 50-bar band', () => {
      /*
       * A 60-bar sine cycle drives the raw period reading beyond the 50-bar cap of the homodyne
       * discriminator. Expectations derived from the TA-Lib port (see above).
       */
      const prices = Array.from({length: 60}, (_, i) => 100 + 30 * Math.sin((2 * Math.PI * i) / 60));
      const mama = new MAMA();
      const results = [];

      for (const price of prices) {
        const result = mama.add(price);

        if (result) {
          results.push(result);
        }
      }

      expect(results.length).toBe(28);

      const last = results[results.length - 1];

      expect(last.mama.toFixed(8)).toBe('81.12254429');
      expect(last.fama.toFixed(8)).toBe('80.37168933');
    });

    it('pins both averages inside the corridor their smoothing limits allow', () => {
      /*
       * The adaptive smoothing factor always stays within (0, 1], so each new MAMA value is a
       * weighted middle between its previous value and the latest price — it may never overshoot
       * either side. FAMA moves at half that speed towards MAMA, so it is pinned between its
       * previous value and the current MAMA the same way.
       */
      const mama = new MAMA();
      let previous: MAMAResult | null = null;

      for (const price of TALIB_MEDIAN_PRICES) {
        const result = mama.add(price);

        if (result && previous) {
          expect(result.mama).toBeGreaterThanOrEqual(Math.min(previous.mama, price));
          expect(result.mama).toBeLessThanOrEqual(Math.max(previous.mama, price));
          expect(result.fama).toBeGreaterThanOrEqual(Math.min(previous.fama, result.mama));
          expect(result.fama).toBeLessThanOrEqual(Math.max(previous.fama, result.mama));
        }

        previous = result;
      }

      expect(mama.isStable).toBe(true);
    });

    it('lets the following average trail the adaptive average through a sustained rise', () => {
      const prices = Array.from({length: 40}, (_, i) => 10 + i);
      const mama = new MAMA();
      let verifiedBars = 0;

      for (const price of prices) {
        const result = mama.add(price);

        if (result) {
          verifiedBars++;
          expect(result.fama).toBeLessThan(result.mama);
        }
      }

      expect(verifiedBars).toBe(8);
    });

    it('converges both averages to the price of a flat series', () => {
      const mama = new MAMA();
      let result: MAMAResult | null = null;

      for (let i = 0; i < 100; i++) {
        result = mama.add(250);
      }

      expect(result?.mama).toBeCloseTo(250, 7);
      expect(result?.fama).toBeCloseTo(250, 7);
    });
  });

  describe('getRequiredInputs', () => {
    it('needs 33 bars, matching the TA-Lib lookback of 32 plus the emitting bar', () => {
      expect(new MAMA().getRequiredInputs()).toBe(33);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const mama = new MAMA();

      for (const price of TALIB_MEDIAN_PRICES.slice(0, 33)) {
        mama.add(price);
      }

      const originalPrice = TALIB_MEDIAN_PRICES[33];
      const originalResult = mama.add(originalPrice);

      expect(originalResult?.mama.toFixed(8)).toBe('85.45854298');
      expect(originalResult?.fama.toFixed(8)).toBe('81.97400517');

      const replacedResult = mama.replace(1_000);

      expect(replacedResult?.mama.toFixed(8)).toBe('542.68212788');
      expect(replacedResult?.fama.toFixed(8)).toBe('197.08402551');

      const restoredResult = mama.replace(originalPrice);

      expect(restoredResult).toStrictEqual(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const mama = new MAMA();

      expect(mama.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});

      for (const price of TALIB_MEDIAN_PRICES.slice(0, 32)) {
        mama.add(price);
      }

      expect(mama.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH when the adaptive average trades above its following average', () => {
      const mama = new MAMA();

      for (let i = 0; i < 40; i++) {
        mama.add(10 + i);
      }

      expect(mama.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the adaptive average trades below its following average', () => {
      const mama = new MAMA();

      for (let i = 0; i < 40; i++) {
        mama.add(10 + i);
      }

      for (const price of [46, 43, 40, 37, 34] as const) {
        mama.add(price);
      }

      expect(mama.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when both averages coincide', () => {
      /*
       * A series pinned at zero keeps both recursive averages exactly at their zero seed, so
       * neither line ever gains an edge over the other.
       */
      const mama = new MAMA();

      for (let i = 0; i < 33; i++) {
        mama.add(0);
      }

      expect(mama.getResultOrThrow()).toEqual({fama: 0, mama: 0});
      expect(mama.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags a change only when the signal switches its state', () => {
      const mama = new MAMA();

      for (let i = 0; i < 33; i++) {
        mama.add(10 + i);
      }

      expect(mama.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});

      mama.add(43);

      expect(mama.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});

      for (let i = 34; i < 40; i++) {
        mama.add(10 + i);
      }

      for (const price of [46, 43, 40, 37] as const) {
        mama.add(price);
      }

      expect(mama.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});

      mama.add(34);

      expect(mama.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BEARISH});
    });
  });
});

testIndicatorContract({
  create: () => new MAMA(),
  divergentInput: 1_000,
  inputs: TALIB_MEDIAN_PRICES.slice(0, 40),
});
