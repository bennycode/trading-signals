import {Big} from 'big.js';
import {RSI} from './RSI';
import {NotEnoughDataError, SMMA} from '..';

import dataFile from '../test/fixtures/RSI/500-candles-WRX-BTC-1h.json';
import prices from '../test/fixtures/prices.json';
import results from '../test/fixtures/RSI/results.json';

const rsi2results = results.interval_2;
const rsi12results = results.interval_12;
const rsi26results = results.interval_26;

describe('RSI', () => {
  describe('getResult', () => {
    it('throws an error when there is not enough input data', () => {
      const rsi = new RSI(2);
      rsi.update(0);
      expect(rsi.isStable).toBeFalse();
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
          const expected = new Big(rsi2results[index]);
          expect(rsi.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
        }
      });

      expect(rsi.lowest!.toFixed(2)).toBe('0.00');
      expect(rsi.highest!.toFixed(2)).toBe('89.13');
    });

    it('calculates RSI with interval 12', () => {
      const rsi = new RSI(12);

      prices.forEach((price, index) => {
        rsi.update(price);
        if (rsi.isStable) {
          const expected = new Big(rsi12results[index]);
          expect(rsi.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
        }
      });

      expect(rsi.lowest!.toFixed(2)).toBe('0.00');
      expect(rsi.highest!.toFixed(2)).toBe('55.65');
    });

    it('calculates RSI with interval 26', () => {
      const rsi = new RSI(26);

      prices.forEach((price, index) => {
        rsi.update(price);
        if (rsi.isStable) {
          const expected = new Big(rsi26results[index]);
          expect(rsi.getResult().toPrecision(12)).toEqual(expected.toPrecision(12));
        }
      });

      expect(rsi.lowest!.toFixed(2)).toBe('0.00');
      expect(rsi.highest!.toFixed(2)).toBe('51.14');
    });

    it('prevents division by zero errors when the average gain and average loss equal 0', () => {
      const rsi = new RSI(1);
      rsi.update(0);
      rsi.update(0);
      expect(rsi.getResult().toFixed(0)).toBe('99');
    });

    /** @see https://github.com/bennycode/trading-signals/issues/64 */
    it(`is compatible with results calculated by 'tulind'`, () => {
      const interval = 14;
      const rsi = new RSI(interval, SMMA);
      const ohlc = Object.values(dataFile);
      const closes = ohlc.map(candle => candle[4]);
      const results: string[] = [];

      for (const close of closes) {
        rsi.update(close);
        if (rsi.isStable) {
          results.push(rsi.getResult().valueOf());
        }
      }

      expect(closes.length).toBe(500);
      expect(results.length).toBe(closes.length - interval);
      expect(results[0].startsWith('78.997289972899')).toBeTrue();
      expect(results[results.length - 1].startsWith('47.3794658392')).toBeTrue();
    });
  });

  describe('isStable', () => {
    // Test data taken from:
    // https://tulipindicators.org/rsi
    it('is stable when the amount of inputs is bigger than the required interval', () => {
      const rsi = new RSI(5);
      rsi.update(81.59);
      rsi.update(81.06);
      rsi.update(82.87);
      expect(rsi.isStable).toBeFalse();
      rsi.update(83.0);
      rsi.update(83.61);
      rsi.update(83.15);
      expect(rsi.isStable).toBeTrue();
      expect(rsi.getResult().toFixed(2)).toBe('72.03');
      rsi.update(82.84);
      expect(rsi.getResult().toFixed(2)).toBe('64.93');
    });
  });
});
