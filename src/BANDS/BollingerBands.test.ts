import {BollingerBands} from './BollingerBands';
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
