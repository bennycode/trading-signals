import {Big as BigNumber} from 'big.js';
import {SMMA} from './SMMA';

import prices from '../test/fixtures/prices.json';
import results from '../test/fixtures/SMMA/results.json';

const smma2results = results.interval_2;
const smma12results = results.interval_12;
const smma26results = results.interval_26;

describe('SMMA', () => {
  describe('getResult', () => {
    it('calculates SMMAs with interval 2', () => {
      const smma = new SMMA(2);

      prices.forEach((price, index) => {
        smma.update(new BigNumber(price));
        const expected = new BigNumber(smma2results[index]);
        expect(smma.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
      });

      expect(smma.lowest!.toFixed(2)).toBe('18.65');
      expect(smma.highest!.toFixed(2)).toBe('89.71');
    });

    it('calculates SMMAs with interval 12', () => {
      const smma = new SMMA(12);

      prices.forEach((price, index) => {
        smma.update(new BigNumber(price));
        const expected = new BigNumber(smma12results[index]);
        expect(smma.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
      });

      expect(smma.lowest!.toFixed(2)).toBe('45.80');
      expect(smma.highest!.toFixed(2)).toBe('59.12');
    });

    it('calculates SMMAs with interval 26', () => {
      const smma = new SMMA(26);

      prices.forEach((price, index) => {
        smma.update(new BigNumber(price));
        const expected = new BigNumber(smma26results[index]);
        expect(smma.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
      });

      expect(smma.lowest!.toFixed(2)).toBe('49.71');
      expect(smma.highest!.toFixed(2)).toBe('55.76');
    });
  });
});
