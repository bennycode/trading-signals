import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {HTTrendline} from './HTTrendline.js';

/*
 * Median prices ((high + low) / 2) of the official 252-bar daily series that TA-Lib ships with its
 * regression suite. TA-Lib's own HT_TRENDLINE regression run transforms the candles into exactly
 * this median price series before feeding them, just as it does for MAMA.
 *
 * Data: https://github.com/TA-Lib/ta-lib/blob/main/src/tools/ta_regtest/test_data.c
 * Setup: https://github.com/TA-Lib/ta-lib/blob/main/src/tools/ta_regtest/ta_test_func/test_1in_1out.c
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

describe('HTTrendline', () => {
  describe('update', () => {
    it('reproduces the published TA-Lib regression values over its official test data', () => {
      /*
       * TA-Lib publishes the expected values of an HT_TRENDLINE run over its 252-bar regression
       * data, along with the output placement (first value on bar 63, 189 values in total):
       *
       * First value: 88.257, then 109.69 / 110.18 / 110.46 for the last three values.
       *
       * https://github.com/TA-Lib/ta-lib/blob/main/src/tools/ta_regtest/ta_test_func/test_1in_1out.c
       * (lines 124-128)
       *
       * TA-Lib's regression harness verifies these published values with an absolute tolerance
       * of 0.01 (`checkExpectedValue` in test_util.c), so the assertions here compare at the
       * same two-decimal precision.
       */
      const trendline = new HTTrendline();
      const results: number[] = [];

      for (const price of TALIB_MEDIAN_PRICES) {
        const result = trendline.add(price);

        if (result) {
          results.push(result);
        }
      }

      expect(results.length).toBe(189);
      expect(results[0].toFixed(2)).toBe('88.26');
      expect(results[186].toFixed(2)).toBe('109.69');
      expect(results[187].toFixed(2)).toBe('110.18');
      expect(results[188].toFixed(2)).toBe('110.46');
    });

    it('matches a line-by-line port of the TA-Lib reference implementation bar for bar', () => {
      /*
       * TA-Lib publishes only spot values of its HT_TRENDLINE regression run, so no full
       * reference sequence exists to copy. The expectations below come from a line-by-line
       * JavaScript port of TA-Lib's `ta_HT_TRENDLINE.c` — a port that reproduces all published
       * regression values over the full 252-bar series (see the test above) — executed over the
       * first 110 median prices. The port keeps TA-Lib's even/odd circular Hilbert buffers and
       * its incremental price smoother while this implementation uses the direct lag windows of
       * Ehlers' original formulation (John Ehlers, "Rocket Science for Traders", Wiley 2001):
       * two independently structured implementations agreeing bar for bar is the verification.
       */
      const prices = TALIB_MEDIAN_PRICES.slice(0, 110);
      const expectations = [
        '88.25769433',
        '88.45963735',
        '88.66700791',
        '88.81622530',
        '88.90691996',
        '88.90407392',
        '88.89295563',
        '88.82955628',
        '88.73609524',
        '88.60788095',
        '88.45622619',
        '88.36189286',
        '88.59767857',
        '89.09284524',
        '89.79313095',
        '90.63239286',
        '91.44016667',
        '92.25157857',
        '93.11091889',
        '93.89093277',
        '94.67599803',
        '95.40030263',
        '96.20697807',
        '97.06590570',
        '98.02379167',
        '99.10251389',
        '100.30231944',
        '101.84904167',
        '103.65027778',
        '105.54236111',
        '106.96161038',
        '108.15077997',
        '109.14576389',
        '109.80531316',
        '110.37407632',
        '110.68598264',
        '110.98864524',
        '111.38325833',
        '111.86535714',
        '112.35978571',
        '112.79923810',
        '113.17471429',
        '113.55866667',
        '114.05777381',
        '114.69320476',
        '115.28468988',
        '115.72290298',
      ] as const;
      const trendline = new HTTrendline();
      const offset = trendline.getRequiredInputs() - 1;
      let verifiedBars = 0;

      prices.forEach((price, i) => {
        const result = trendline.add(price);

        if (result) {
          verifiedBars++;
          expect(result.toFixed(8)).toBe(expectations[i - offset]);
        }
      });

      expect(verifiedBars).toBe(expectations.length);
    });

    it('converges to the constant of a flat series', () => {
      /*
       * Averaging any window of a flat series returns the constant itself, and the 4-3-2-1
       * weighting of identical values is again that constant, so every emission sits exactly on
       * the price — no drift, no seed residue.
       */
      const trendline = new HTTrendline();
      let emittedBars = 0;

      for (let i = 0; i < 100; i++) {
        const result = trendline.add(250);

        if (result) {
          emittedBars++;
          expect(result).toBe(250);
        }
      }

      expect(emittedBars).toBe(37);
    });

    it('trails a steadily rising price from below within the width of its averaging window', () => {
      /*
       * A steady ramp offers no cycle to cancel, so the dominant cycle window degrades into a
       * plain average of recent prices: the trendline runs below the rising price, but never
       * further behind than its at-most-50-bar window plus one bar of final smoothing allows —
       * 25.5 price steps. Expectations for the boundary values derived from the TA-Lib port
       * (see above).
       */
      const trendline = new HTTrendline();
      const results: number[] = [];

      for (let i = 0; i < 100; i++) {
        const price = 10 + i;
        const result = trendline.add(price);

        if (result) {
          results.push(result);
          expect(result).toBeLessThan(price);
          expect(result).toBeGreaterThanOrEqual(price - 25.5);
        }
      }

      expect(results.length).toBe(37);
      expect(results[0].toFixed(2)).toBe('60.20');
      expect(results[results.length - 1].toFixed(2)).toBe('86.15');
    });

    it('follows a slow swing whose cycle is longer than the measurable 50-bar band', () => {
      /*
       * A 60-bar sine cycle drives the raw period reading beyond the 50-bar cap of the homodyne
       * discriminator. Expectations derived from the TA-Lib port (see above).
       */
      const prices = Array.from({length: 100}, (_, i) => 100 + 30 * Math.sin((2 * Math.PI * i) / 60));
      const trendline = new HTTrendline();
      const results: number[] = [];

      for (const price of prices) {
        const result = trendline.add(price);

        if (result) {
          results.push(result);
        }
      }

      expect(results.length).toBe(37);
      expect(results[0].toFixed(8)).toBe('80.94674498');
      expect(results[results.length - 1].toFixed(8)).toBe('105.63074564');
    });
  });

  describe('getRequiredInputs', () => {
    it('needs 64 bars, matching the TA-Lib lookback of 63 plus the emitting bar', () => {
      expect(new HTTrendline().getRequiredInputs()).toBe(64);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const trendline = new HTTrendline();

      for (const price of TALIB_MEDIAN_PRICES.slice(0, 64)) {
        trendline.add(price);
      }

      const originalPrice = TALIB_MEDIAN_PRICES[64];
      const originalResult = trendline.add(originalPrice);

      expect(originalResult?.toFixed(8)).toBe('88.45963735');

      const replacedResult = trendline.replace(1_000);

      expect(replacedResult?.toFixed(8)).toBe('104.25663735');

      const restoredResult = trendline.replace(originalPrice);

      expect(restoredResult).toBe(originalResult);
    });
  });
});

testIndicatorContract({
  create: () => new HTTrendline(),
  divergentInput: 1_000,
  inputs: TALIB_MEDIAN_PRICES.slice(0, 70),
});
