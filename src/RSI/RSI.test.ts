import {Big as BigNumber} from 'big.js';
import {RSI} from './RSI';

import prices from '../test/fixtures/prices.json';
import * as results from '../test/fixtures/RSI/results.json';

const rsi2results = results.interval_2;
const rsi12results = results.interval_12;
const rsi26results = results.interval_26;

describe('RSI', () => {
  describe('getResult', () => {
    it('calculates RSI with interval 2', () => {
      const rsi = new RSI(2);
      prices.forEach((price, index) => {
        rsi.update(price);
        const res = new BigNumber(rsi2results[index]);
        expect(rsi.getResult().toPrecision(12)).toEqual(res.toPrecision(12));
      });
    });

    it('calculates RSI with interval 12', () => {
      const rsi = new RSI(12);
      prices.forEach((price, index) => {
        rsi.update(price);
        const res = new BigNumber(rsi12results[index]);
        expect(rsi.getResult().toPrecision(12)).toEqual(res.toPrecision(12));
      });
    });

    it('calculates RSI with interval 26', () => {
      const rsi = new RSI(26);
      prices.forEach((price, index) => {
        rsi.update(price);
        const res = new BigNumber(rsi26results[index]);
        expect(rsi.getResult().toPrecision(12)).toEqual(res.toPrecision(12));
      });
    });
  });
});
