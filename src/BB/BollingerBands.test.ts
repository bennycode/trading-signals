import {BollingerBands} from './BollingerBands';
import {Big} from 'big.js';

import results from '../test/fixtures/BB/results.json';
import {NotEnoughDataError} from '../error';

describe('BollingerBands', () => {
  describe('getResult', () => {
    it('calculates Bollinger Bands with interval 20', () => {
      const bb = new BollingerBands(20);

      results.prices.forEach((price, index) => {
        bb.update(new Big(price));

        if (!bb.isStable) {
          return;
        }

        const resMiddle = new Big(Number(results.middle[index]));
        const resLower = new Big(Number(results.lower[index]));
        const resUpper = new Big(Number(results.upper[index]));

        const {middle, upper, lower} = bb.getResult();

        expect(middle.toPrecision(12)).toEqual(resMiddle.toPrecision(12));
        expect(lower.toPrecision(12)).toEqual(resLower.toPrecision(12));
        expect(upper.toPrecision(12)).toEqual(resUpper.toPrecision(12));
      });
    });

    it('has a default configuration', () => {
      const bb = new BollingerBands();
      expect(bb.interval).toBe(0);
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
  });
});
