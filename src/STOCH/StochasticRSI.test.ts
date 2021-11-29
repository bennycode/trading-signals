import {FasterStochasticRSI, StochasticRSI} from './StochasticRSI';

describe('StochasticRSI', () => {
  describe('getResult', () => {
    it('calculates the Stochastic RSI', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/0bc8dfc46cfc89366bf8cef6dfad1fb6f81b3b7b/tests/untest.txt#L382-L384
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];
      const expectations = ['0.658', '1.000', '1.000', '1.000', '1.000', '0.000'];
      const stochRSI = new StochasticRSI(5);
      const fasterStochRSI = new FasterStochasticRSI(5);
      for (const price of prices) {
        const result = stochRSI.update(price);
        const fasterResult = fasterStochRSI.update(price);
        if (result && fasterResult) {
          const expected = expectations.shift();
          expect(result.toFixed(3)).toBe(expected!);
          expect(fasterResult.toFixed(3)).toBe(expected!);
        }
      }
      expect(stochRSI.isStable).toBeTrue();
      expect(fasterStochRSI.isStable).toBeTrue();

      expect(stochRSI.getResult().valueOf()).toBe('0');
      expect(fasterStochRSI.getResult()).toBe(0);

      expect(stochRSI.highest!.valueOf()).toBe('1');
      expect(fasterStochRSI.highest!.valueOf()).toBe(1);

      expect(stochRSI.lowest!.valueOf()).toBe('0');
      expect(fasterStochRSI.lowest!.valueOf()).toBe(0);
    });
  });
});
