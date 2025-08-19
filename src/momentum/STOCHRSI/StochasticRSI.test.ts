import {SMA} from '../../trend/SMA/SMA.js';
import {WSMA} from '../../trend/WSMA/WSMA.js';
import {StochasticRSI} from './StochasticRSI.js';

describe('StochasticRSI', () => {
  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 2;
      const stochRSI = new StochasticRSI(interval);
      const stochRSIWithReplace = new StochasticRSI(interval);

      stochRSI.updates([1, 2, 3, 4], false);
      stochRSIWithReplace.updates([1, 2, 3, 5], false);
      stochRSIWithReplace.replace(4);

      expect(stochRSI.getResultOrThrow()).toBe(stochRSIWithReplace.getResultOrThrow());
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Stochastic RSI', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/0bc8dfc46cfc89366bf8cef6dfad1fb6f81b3b7b/tests/untest.txt#L382-L384
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expectations = ['0.658', '1.000', '1.000', '1.000', '1.000', '0.000'] as const;
      const interval = 5;
      const stochRSI = new StochasticRSI(interval);
      const offset = stochRSI.getRequiredInputs() - 1;
      prices.forEach((price, index) => {
        const result = stochRSI.add(price);
        if (result) {
          const expected = expectations[index - offset];
          expect(result.toFixed(3)).toBe(expected);
        }
      });
      expect(stochRSI.isStable).toBe(true);
      expect(stochRSI.getRequiredInputs()).toBe(10);
      expect(stochRSI.getResultOrThrow()).toBe(0);
    });

    it('calculates smoothing %K and %D lines', () => {
      // Test data based on:
      // https://github.com/bennycode/trading-signals/issues/793#issuecomment-2820887096
      const prices = [
        87069.6, 86963.1, 87041.8, 87132.1, 87178.1, 87300, 87231, 87471.9, 87475.2, 87554.8, 87346.1, 87652, 87716.1,
        88360, 88428.1, 88354, 88316, 88038.3, 87916.5, 88147.8, 87870.1, 88110.1, 88210, 88122.1, 88181.9, 88240.2,
        88238.4, 88028, 87937.7, 88100.6, 88238.5, 88337.9, 88124, 88057.4, 88026, 88198.2, 88128, 88248, 88423.5,
        88447.7, 88509.5, 88374.1, 88340.1, 88372.4, 88319.9, 88498, 88483.3, 88544, 88563, 88294.1,
      ] as const;
      const expectations = [
        {d: '25.52', k: '47.24', stochRSI: '70.55'},
        {d: '39.27', k: '46.86', stochRSI: '15.66'},
        {d: '40.94', k: '28.74', stochRSI: '0.00'},
        {d: '26.94', k: '5.22', stochRSI: '0.00'},
        {d: '15.67', k: '13.05', stochRSI: '39.14'},
        {d: '12.59', k: '19.49', stochRSI: '19.33'},
        {d: '22.62', k: '35.32', stochRSI: '47.49'},
        {d: '35.12', k: '50.55', stochRSI: '84.84'},
        {d: '53.36', k: '74.21', stochRSI: '90.30'},
        {d: '72.16', k: '91.71', stochRSI: '100.00'},
        {d: '82.27', k: '80.87', stochRSI: '52.31'},
        {d: '78.97', k: '64.34', stochRSI: '40.71'},
        {d: '64.17', k: '47.32', stochRSI: '48.93'},
        {d: '50.45', k: '39.70', stochRSI: '29.47'},
        {d: '46.10', k: '51.29', stochRSI: '75.48'},
        {d: '49.74', k: '58.21', stochRSI: '69.69'},
        {d: '62.09', k: '76.77', stochRSI: '85.14'},
        {d: '71.94', k: '80.85', stochRSI: '87.73'},
        {d: '71.75', k: '57.62', stochRSI: '0.00'},
      ] as const;
      const callCount = vi.fn();
      const offset = prices.length - expectations.length;

      const stochRSI = new StochasticRSI(14, WSMA, {
        d: new SMA(3),
        k: new SMA(3),
      });

      prices.forEach((price, i) => {
        stochRSI.add(price);

        if (stochRSI.smoothing.d.isStable) {
          callCount();
          const expectation = expectations[i - offset];
          const resultObj = {
            d: (stochRSI.smoothing.d.getResultOrThrow() * 100).toFixed(2),
            k: (stochRSI.smoothing.k.getResultOrThrow() * 100).toFixed(2),
            stochRSI: (stochRSI.getResultOrThrow() * 100).toFixed(2),
          };
          expect(resultObj).toEqual(expectation);
        }
      });

      expect(callCount).toHaveBeenCalledTimes(expectations.length);
    });

    it('catches division by zero errors', () => {
      const interval = 2;
      const stochRSI = new StochasticRSI(interval);
      stochRSI.updates([2, 2, 2, 2], false);
      expect(stochRSI.getResultOrThrow()).toBe(100);
    });
  });
});
