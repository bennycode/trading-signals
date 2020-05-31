import {Big as BigNumber} from 'big.js';
import {DEMA} from './DEMA';

import prices from '../test/fixtures/prices.json';
import results from '../test/fixtures/DEMA/results.json';

const dema10results = results.interval_10;

describe('DEMA', () => {
  describe('getResult', () => {
    it('calculates the DEMA with interval 10', () => {
      const dema = new DEMA(10);

      prices.forEach((price, index) => {
        dema.update(new BigNumber(price));
        const result = new BigNumber(dema10results[index]);
        expect(dema.getResult().toPrecision(12)).toEqual(result.toPrecision(12));
      });
    });

    it('throws an error when there is not enough input data', () => {
      const dema = new DEMA(10);
      expect(() => dema.getResult()).toThrowError();
    });
  });
});
