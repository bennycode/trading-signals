import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {ALMA} from './ALMA.js';

describe('ALMA', () => {
  /*
   * Test data verified with the ALMA(9, 0.85, 6) baseline of "Skender.Stock.Indicators" v3.0.0.
   * Prices are the first 20 closes of its reference quote history:
   * https://github.com/DaveSkender/Stock.Indicators/blob/3.0.0/tests/indicators/_testdata/quotes/default.csv#L2-L21
   * Expectations are its committed baseline results, rounded to 7 decimal places:
   * https://github.com/DaveSkender/Stock.Indicators/blob/3.0.0/tests/indicators/_testdata/results/alma.standard.json#L36-L80
   */
  const prices = [
    212.8, 214.06, 213.89, 214.66, 213.95, 213.95, 214.55, 214.02, 214.51, 213.75, 214.22, 213.43, 214.21, 213.66,
    215.03, 216.89, 216.66, 216.32, 214.98, 214.96,
  ] as const;
  const expectations = [
    '214.2611591',
    '214.1828154',
    '214.1391983',
    '213.9577828',
    '213.9241142',
    '213.8637213',
    '214.1054047',
    '214.8606438',
    '215.6817140',
    '216.2088357',
    '216.0927793',
    '215.6764184',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const alma = new ALMA(9);

      alma.updates(prices, false);

      const originalValue = 220;
      const replacedValue = 210;

      const originalResult = alma.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('216.39');

      const replacedResult = alma.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('214.19');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = alma.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Skender.Stock.Indicators', () => {
      const interval = 9;
      const alma = new ALMA(interval);
      const offset = alma.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = alma.add(price);

        if (result) {
          expect(result.toFixed(7)).toBe(expectations[i - offset]);
        }
      });

      expect(alma.isStable).toBe(true);
      expect(alma.getRequiredInputs()).toBe(interval);
    });

    it('supports a custom offset and sigma', () => {
      /*
       * Hand-derived: with an interval of 3, offset 0.9 and sigma 3, the bell peaks at
       * m = 0.9 * (3 - 1) = 1.8 with spread s = 3 / 3 = 1, so the weights are:
       * w0 = exp(-(0 - 1.8)^2 / 2) = exp(-1.62) = 0.19789869908361465
       * w1 = exp(-(1 - 1.8)^2 / 2) = exp(-0.32) = 0.72614903707369090
       * w2 = exp(-(2 - 1.8)^2 / 2) = exp(-0.02) = 0.98019867330675540
       * ALMA = (10 * w0 + 20 * w1 + 40 * w2) / (w0 + w1 + w2)
       *      = 55.70991466458018 / 1.904246409464061 = 29.25562279529749
       */
      const alma = new ALMA(3, 0.9, 3);

      alma.add(10);
      alma.add(20);
      alma.add(40);

      expect(alma.getResultOrThrow().toFixed(4)).toBe('29.2556');
    });

    it('stays on the price level when the market is completely flat', () => {
      const alma = new ALMA(5);

      for (let i = 0; i < 8; i++) {
        alma.add(100);
      }

      /*
       * The weighted price sum is normalized by the weight total, so a flat market reproduces
       * the price level up to one ulp of floating-point rounding.
       */
      expect(alma.getResultOrThrow()).toBeCloseTo(100, 12);
    });

    it('returns the window midpoint of a linear ramp when the bell is centered', () => {
      /*
       * With offset 0.5 the bell is symmetric around the window middle, so on a linear ramp
       * every paired deviation cancels and the average lands on the midpoint price. The math
       * is exact; summation order leaves at most one ulp of floating-point rounding.
       */
      const rampPrices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
      const midpoints = [5, 6, 7] as const;
      const alma = new ALMA(9, 0.5, 6);
      const offset = alma.getRequiredInputs() - 1;

      rampPrices.forEach((price, i) => {
        const result = alma.add(price);

        if (result) {
          expect(result).toBeCloseTo(midpoints[i - offset], 12);
        }
      });

      expect(alma.isStable).toBe(true);
    });
  });

  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const alma = new ALMA(3);

      alma.add(1);
      alma.add(2);
      expect(alma.prices.length).toBe(2);
      alma.add(3);
      expect(alma.prices.length).toBe(3);
      alma.add(4);
      expect(alma.prices.length).toBe(3);
    });
  });
});

testIndicatorContract({
  create: () => new ALMA(5),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15],
});
