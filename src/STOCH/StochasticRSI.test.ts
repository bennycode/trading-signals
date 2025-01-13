import {FasterStochasticRSI, StochasticRSI} from './StochasticRSI.js';

describe('StochasticRSI', () => {
  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 2;
      const stochRSI = new StochasticRSI(interval);
      const stochRSIWithReplace = new StochasticRSI(interval);

      stochRSI.updates([2, 2, 2, 2], false);
      stochRSIWithReplace.updates([2, 2, 2, 1], false);
      stochRSIWithReplace.replace(2);

      expect(stochRSI.getResultOrThrow().valueOf()).toBe(stochRSIWithReplace.getResultOrThrow().valueOf());
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Stochastic RSI', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/0bc8dfc46cfc89366bf8cef6dfad1fb6f81b3b7b/tests/untest.txt#L382-L384
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];
      const expectations = ['0.658', '1.000', '1.000', '1.000', '1.000', '0.000'];
      const interval = 5;
      const stochRSI = new StochasticRSI(interval);
      const fasterStochRSI = new FasterStochasticRSI(interval);
      for (const price of prices) {
        const result = stochRSI.add(price);
        const fasterResult = fasterStochRSI.add(price);
        if (result && fasterResult) {
          const expected = expectations.shift();
          expect(result.toFixed(3)).toBe(expected!);
          expect(fasterResult.toFixed(3)).toBe(expected!);
        }
      }
      expect(stochRSI.isStable).toBe(true);
      expect(fasterStochRSI.isStable).toBe(true);

      expect(stochRSI.getResultOrThrow().valueOf()).toBe('0');
      expect(fasterStochRSI.getResultOrThrow()).toBe(0);

      expect(stochRSI.highest!.valueOf()).toBe('1');
      expect(fasterStochRSI.highest!.valueOf()).toBe(1);

      expect(stochRSI.lowest!.valueOf()).toBe('0');
      expect(fasterStochRSI.lowest!.valueOf()).toBe(0);
    });

    it('catches division by zero errors', () => {
      const interval = 2;
      const stochRSI = new StochasticRSI(interval);
      stochRSI.updates([2, 2, 2, 2], false);
      expect(stochRSI.getResultOrThrow().valueOf()).toBe('100');

      const fasterStochRSI = new FasterStochasticRSI(interval);
      fasterStochRSI.updates([2, 2, 2, 2], false);
      expect(fasterStochRSI.getResultOrThrow().valueOf()).toBe(100);
    });
  });
});
