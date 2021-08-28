import {Big} from 'big.js';
import {DEMA} from './DEMA';

import prices from '../test/fixtures/prices.json';
import results from '../test/fixtures/DEMA/results.json';
import {NotEnoughDataError} from '../error';

const dema10results = results.interval_10;

describe('DEMA', () => {
  describe('getResult', () => {
    it('calculates the DEMA with interval 10', () => {
      const dema = new DEMA(10);

      prices.forEach((price, index) => {
        dema.update(new Big(price));
        if (dema.isStable) {
          const result = new Big(dema10results[index]);
          expect(dema.getResult().toPrecision(12)).toEqual(result.toPrecision(12));
        }
      });

      expect(dema.lowest!.toFixed(2)).toBe('24.89');
      expect(dema.highest!.toFixed(2)).toBe('83.22');
    });

    it('throws an error when there is not enough input data', () => {
      const dema = new DEMA(10);

      try {
        dema.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('is stable when there are enough inputs to fill the interval', () => {
      const dema = new DEMA(2);
      expect(dema.isStable).toBeFalse();
      dema.update(1);
      dema.update(2);
      expect(dema.isStable).toBeTrue();
      expect(dema.lowest!.toFixed(2)).toBe('1.00');
      expect(dema.highest!.toFixed(2)).toBe('1.89');
    });
  });
});
