import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {EMA} from '../EMA/EMA.js';
import {T3} from './T3.js';

describe('T3', () => {
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const t3 = new T3(3);

      t3.updates(prices, false);

      const originalValue = 90;
      const replacedValue = 83;

      const originalResult = t3.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('88.35');

      const replacedResult = t3.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('86.20');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = t3.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    /*
     * Hand-derived from Tillson's definition, because no external fixture matches this seeding:
     * Tulip Indicators does not implement T3, and TA-Lib seeds each cascade stage with an SMA
     * while this cascade seeds every stage with its first input (the TEMA convention), so
     * published TA-Lib values cannot agree on the early readings.
     *
     * Interval 2 means every stage weights its newest input with k = 2 / (2 + 1) = 2/3 and its
     * previous reading with 1/3. A stage emits its first reading as a copy of its first input
     * and starts feeding the next stage one bar later, once it has seen two inputs.
     *
     * Cascade for the rising series (columns are the six smoothing stages e1..e6):
     *
     * 10 -> 10
     * 11 -> 10.666666667 | 10.666666667
     * 12 -> 11.555555556 | 11.259259259 | 11.259259259
     * 13 -> 12.518518519 | 12.098765432 | 11.818930041 | 11.818930041
     * 14 -> 13.506172840 | 13.037037037 | 12.631001372 | 12.360310928 | 12.360310928
     * 15 -> 14.502057613 | 14.013717421 | 13.552812071 | 13.155311690 | 12.890311436 | 12.890311436
     * 16 -> 15.500685871 | 15.005029721 | 14.520957171 | 14.065742011 | 13.673931819 | 13.412725025
     * 17 -> 16.500228624 | 16.001828989 | 15.508205050 | 15.027384037 | 14.576233298 | 14.188397207
     *
     * Weights for the default volume factor a = 0.7:
     *
     * c1 = -a^3                  = -0.343
     * c2 = 3a^2 + 3a^3           =  2.499
     * c3 = -6a^2 - 3a - 3a^3     = -6.069
     * c4 = 1 + 3a + a^3 + 3a^2   =  4.913
     *
     * First reading (bar 7, all six stages warmed up), T3 = c1*e6 + c2*e5 + c3*e4 + c4*e3:
     *
     * T3 = -0.343 * 13.412725025 + 2.499 * 13.673931819 - 6.069 * 14.065742011 + 4.913 * 14.520957171
     *    = 15.547065251
     *
     * Bar 8:
     *
     * T3 = -0.343 * 14.188397207 + 2.499 * 14.576233298 - 6.069 * 15.027384037 + 4.913 * 15.508205050
     *    = 16.550004460
     */
    const risingPrices = [10, 11, 12, 13, 14, 15, 16, 17] as const;

    it('matches the hand-derived cascade with the default volume factor', () => {
      const expectations = ['15.547065251', '16.550004460'] as const;
      const t3 = new T3(2);
      const offset = t3.getRequiredInputs() - 1;

      risingPrices.forEach((price, i) => {
        const result = t3.add(price);

        if (result) {
          expect(result.toFixed(9)).toBe(expectations[i - offset]);
        }
      });

      expect(t3.isStable).toBe(true);
      expect(t3.getRequiredInputs()).toBe(7);
    });

    /*
     * Same cascade as above (the six smoothing stages ignore the volume factor), only the
     * weights change for a = 0.5:
     *
     * c1 = -0.125, c2 = 1.125, c3 = -3.375, c4 = 3.375
     *
     * Bar 7: -0.125 * 13.412725025 + 1.125 * 13.673931819 - 3.375 * 14.065742011 + 3.375 * 14.520957171 = 15.242933835
     * Bar 8: -0.125 * 14.188397207 + 1.125 * 14.576233298 - 3.375 * 15.027384037 + 3.375 * 15.508205050 = 16.247483728
     */
    it('weights the cascade differently with an explicit volume factor', () => {
      const expectations = ['15.242933835', '16.247483728'] as const;
      const t3 = new T3(2, 0.5);
      const offset = t3.getRequiredInputs() - 1;

      risingPrices.forEach((price, i) => {
        const result = t3.add(price);

        if (result) {
          expect(result.toFixed(9)).toBe(expectations[i - offset]);
        }
      });

      expect(t3.isStable).toBe(true);
    });

    it("defaults to Tillson's recommended volume factor of 0.7", () => {
      const defaultT3 = new T3(2);
      const explicitT3 = new T3(2, 0.7);

      expect(defaultT3.volumeFactor).toBe(0.7);

      for (const price of risingPrices) {
        expect(defaultT3.add(price)).toBe(explicitT3.add(price));
      }
    });

    it('equals a triple-smoothed EMA when the volume factor is zero', () => {
      const t3 = new T3(3, 0);
      const singleEMA = new EMA(3);
      const doubleEMA = new EMA(3);
      const tripleEMA = new EMA(3);

      for (const price of prices) {
        t3.add(price);
        singleEMA.add(price);

        if (singleEMA.isStable) {
          doubleEMA.add(singleEMA.getResultOrThrow());

          if (doubleEMA.isStable) {
            tripleEMA.add(doubleEMA.getResultOrThrow());
          }
        }
      }

      expect(t3.getResultOrThrow()).toBe(tripleEMA.getResultOrThrow());
    });

    it('converges to the price level when the market is completely flat', () => {
      const t3 = new T3(5);

      for (let i = 0; i < 25; i++) {
        t3.add(100);
      }

      expect(t3.getResultOrThrow()).toBeCloseTo(100, 12);
    });
  });
});

testIndicatorContract({
  create: () => new T3(3),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29],
});
