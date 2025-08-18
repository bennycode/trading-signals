import {BollingerBands} from './BollingerBands.js';
import data from '../../fixtures/BB/data.json' with {type: 'json'};
import {NotEnoughDataError} from '../../error/index.js';

describe('BollingerBands', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const bb = new BollingerBands(3);
      bb.updates([1, 2]);
      expect(bb.prices.length).toBe(2);
      bb.add(3);
      expect(bb.prices.length).toBe(3);
      bb.add(4);
      expect(bb.prices.length).toBe(3);
      bb.add(5);
      expect(bb.prices.length).toBe(3);
      bb.add(6);
      expect(bb.prices.length).toBe(3);
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates Bollinger Bands with interval 20', () => {
      const bb = new BollingerBands(20);

      data.prices.forEach((price, index) => {
        bb.add(price);

        if (!bb.isStable) {
          return;
        }

        const resMiddle = Number(data.middle[index]);
        const resLower = Number(data.lower[index]);
        const resUpper = Number(data.upper[index]);

        const {middle, upper, lower} = bb.getResultOrThrow();

        expect(middle.toPrecision(12)).toEqual(resMiddle.toPrecision(12));
        expect(lower.toPrecision(12)).toEqual(resLower.toPrecision(12));
        expect(upper.toPrecision(12)).toEqual(resUpper.toPrecision(12));
      });
    });

    it('has a default standard deviation multiplier configuration', () => {
      const bb = new BollingerBands(5);
      expect(bb.interval).toBe(5);
      expect(bb.deviationMultiplier).toBe(2);
    });

    it('throws an error when there is not enough input data', () => {
      const bb = new BollingerBands(20);

      try {
        bb.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('is compatible with results from Tulip Indicators (TI)', () => {
      // Test data verified with:
      // https://tulipindicators.org/bbands
      // https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L86
      const inputs = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;

      const expectedLows = [
        undefined,
        undefined,
        undefined,
        undefined,
        '80.53',
        '80.99',
        '82.53',
        '82.47',
        '82.42',
        '82.44',
        '82.51',
        '83.14',
        '83.54',
        '83.87',
        '85.29',
      ] as const;

      const expectedMids = [
        undefined,
        undefined,
        undefined,
        undefined,
        '82.43',
        '82.74',
        '83.09',
        '83.32',
        '83.63',
        '83.78',
        '84.25',
        '84.99',
        '85.57',
        '86.22',
        '86.80',
      ] as const;

      const expectedUps = [
        undefined,
        undefined,
        undefined,
        undefined,
        '84.32',
        '84.49',
        '83.65',
        '84.16',
        '84.84',
        '85.12',
        '86.00',
        '86.85',
        '87.61',
        '88.57',
        '88.32',
      ] as const;

      const interval = 5;
      const bb = new BollingerBands(interval, 2);
      expect(bb.getRequiredInputs()).toBe(interval);

      for (let i = 0; i < inputs.length; i++) {
        const price = inputs[i];
        bb.add(price);
        if (bb.isStable) {
          const {lower, middle, upper} = bb.getResultOrThrow();
          const expectedLow = expectedLows[i];
          const expectedMid = expectedMids[i];
          const expectedUp = expectedUps[i];
          expect(lower.toFixed(2)).toBe(`${expectedLow}`);
          expect(middle.toFixed(2)).toBe(`${expectedMid}`);
          expect(upper.toFixed(2)).toBe(`${expectedUp}`);
        }
      }
    });
  });
});
