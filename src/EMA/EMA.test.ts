import Big from 'big.js';
import {EMA} from '..';

import results from '../test/fixtures/EMA/results.json';
import prices from '../test/fixtures/prices.json';

const ema10results = results.weight_10;
const ema12results = results.weight_12;
const ema26results = results.weight_26;

describe('EMA', () => {
  describe('getResult', () => {
    it('correctly calculates EMAs with weight 10', () => {
      const ema = new EMA(10);
      prices.forEach((price, index) => {
        ema.update(new Big(price));
        const actual = ema.getResult();
        const expected = new Big(ema10results[index]);
        expect(actual!.toPrecision(12)).toEqual(expected.toPrecision(12));
      });
    });

    it('correctly calculates EMAs with weight 12', () => {
      const ema = new EMA(12);
      prices.forEach((price, index) => {
        ema.update(new Big(price));
        const actual = ema.getResult();
        const expected = new Big(ema12results[index]);
        expect(actual!.toPrecision(12)).toEqual(expected.toPrecision(12));
      });
    });

    it('correctly calculates EMAs with weight 26', () => {
      const ema = new EMA(26);
      prices.forEach((price, index) => {
        ema.update(new Big(price));
        const actual = ema.getResult();
        const expected = new Big(ema26results[index]);
        expect(actual!.toPrecision(12)).toEqual(expected.toPrecision(12));
      });
    });

    it('throws an error if there is not enough input data', () => {
      const ema = new EMA(10);
      try {
        ema.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
