import {Big as BigNumber} from 'big.js';
import {RSI} from './RSI';

import prices from '../test/fixtures/prices.json';
import results from '../test/fixtures/RSI/results.json';
import {NotEnoughDataError} from '..';

const rsi2results = results.interval_2;
const rsi12results = results.interval_12;
const rsi26results = results.interval_26;

describe('RSI', () => {
  describe('getResult', () => {
    it('throws an error when there is not enough input data', () => {
      const rsi = new RSI(2);
      rsi.update(0);

      try {
        rsi.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('calculates RSI with interval 2', () => {
      const rsi = new RSI(2);
      prices.forEach((price, index) => {
        rsi.update(price);
        if (rsi.isStable) {
          const expected = new BigNumber(rsi2results[index]);
          expect(rsi.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
        }
      });
    });

    it('calculates RSI with interval 12', () => {
      const rsi = new RSI(12);
      prices.forEach((price, index) => {
        rsi.update(price);
        if (rsi.isStable) {
          const expected = new BigNumber(rsi12results[index]);
          expect(rsi.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
        }
      });
    });

    it('calculates RSI with interval 26', () => {
      const rsi = new RSI(26);
      prices.forEach((price, index) => {
        rsi.update(price);
        if (rsi.isStable) {
          const expected = new BigNumber(rsi26results[index]);
          expect(rsi.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
        }
      });
    });

    it('prevents division by zero errors when the average gain and average loss equal 0', () => {
      const rsi = new RSI(1);
      rsi.update(0);
      rsi.update(0);
      expect(rsi.getResult().toFixed(0)).toBe('99');
    });
  });

  describe('isStable', () => {
    it('is stable when the amount of inputs is higher than the required interval', () => {
      const rsi = new RSI(14);
      rsi.update('62.69000000');
      rsi.update('62.71000000');
      rsi.update('62.29000000');
      expect(rsi.isStable).toBeFalse();
    });
  });
});
