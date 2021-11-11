import {BollingerBands, FasterBollingerBands} from './BollingerBands';
import {Big} from 'big.js';
import data from '../test/fixtures/BB/data.json';
import {NotEnoughDataError} from '../error';

describe('BollingerBands', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const bb = new BollingerBands(3);
      bb.update(1);
      bb.update(2);
      expect(bb.prices.length).toBe(2);
      bb.update(3);
      expect(bb.prices.length).toBe(3);
      bb.update(4);
      expect(bb.prices.length).toBe(3);
      bb.update(5);
      expect(bb.prices.length).toBe(3);
      bb.update(6);
      expect(bb.prices.length).toBe(3);
    });
  });

  describe('getResult', () => {
    it('calculates Bollinger Bands with interval 20', () => {
      const bb = new BollingerBands(20);

      data.prices.forEach((price, index) => {
        bb.update(new Big(price));

        if (!bb.isStable) {
          return;
        }

        const resMiddle = new Big(Number(data.middle[index]));
        const resLower = new Big(Number(data.lower[index]));
        const resUpper = new Big(Number(data.upper[index]));

        const {middle, upper, lower} = bb.getResult();

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
        bb.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('is compatible with results from Tulip Indicators (TI)', () => {
      // Test data verified with:
      // https://tulipindicators.org/bbands
      const inputs = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];

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
      ];

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
      ];

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
      ];

      const bb = new BollingerBands(5, 2);

      for (let i = 0; i < inputs.length; i++) {
        const price = inputs[i];
        bb.update(price);
        if (bb.isStable) {
          const {lower, middle, upper} = bb.getResult();
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

describe('FasterBollingerBands', () => {
  describe('getResult', () => {
    it('only works with plain numbers', () => {
      // Test data verified with:
      // https://tulipindicators.org/bbands
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];
      const fasterBB = new FasterBollingerBands(5, 2);
      for (const price of prices) {
        fasterBB.update(price);
      }
      expect(fasterBB.isStable).toBeTrue();
      const actual = fasterBB.getResult();
      expect(actual.lower.toFixed(2)).toBe('85.29');
      expect(actual.middle.toFixed(2)).toBe('86.80');
      expect(actual.upper.toFixed(2)).toBe('88.32');
    });

    it('throws an error when there is not enough input data', () => {
      const fasterBB = new FasterBollingerBands(5);

      try {
        fasterBB.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
