import {Big as BigNumber} from 'big.js';
import {EMA} from '..';
import {RSI} from './RSI';

import candles from '../test/fixtures/RSI/500-candles-WRX-BTC-1h.json';
import prices from '../test/fixtures/prices.json';
import results from '../test/fixtures/RSI/results.json';

const rsi2results = results.interval_2;
const rsi12results = results.interval_12;
const rsi26results = results.interval_26;

describe('RSI', () => {
  describe('getResult', () => {
    it('calculates RSI with interval 2', () => {
      const rsi = new RSI(2);
      prices.forEach((price, index) => {
        rsi.update(price);
        const expected = new BigNumber(rsi2results[index]);
        expect(rsi.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
      });
    });

    it('calculates RSI with interval 12', () => {
      const rsi = new RSI(12);
      prices.forEach((price, index) => {
        rsi.update(price);
        const expected = new BigNumber(rsi12results[index]);
        expect(rsi.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
      });
    });

    it('calculates RSI with interval 26', () => {
      const rsi = new RSI(26);
      prices.forEach((price, index) => {
        rsi.update(price);
        const expected = new BigNumber(rsi26results[index]);
        expect(rsi.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
      });
    });

    fit('supports using EMAs for calculation', () => {
      const rsi = new RSI(14, EMA);

      for (const candle of Object.values(candles)) {
        const closingPrice = candle[4];
        rsi.update(closingPrice);
      }

      expect(rsi.getResult().valueOf()).toBe('70');
    });

    it('prevents division by zero errors when the average gain and average loss equal 0', () => {
      const rsi = new RSI(1);
      rsi.update(0);
      rsi.update(0);
      expect(rsi.getResult().toFixed(0)).toBe('99');
    });
  });
});
