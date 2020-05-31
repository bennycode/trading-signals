import {MACD} from './MACD';
import Big from 'big.js';

import prices from '../test/fixtures/prices.json';
import results from '../test/fixtures/MACD/results.json';

describe('MACD', () => {
  describe('getResult', () => {
    it('calculates MACD diff, signal & result with 12/26/9', () => {
      const indicator = new MACD({longInterval: 26, shortInterval: 12, signalInterval: 9, useDEMA: false});
      prices.forEach((price, index) => {
        indicator.update(new Big(price));

        const {macd, signal, diff} = indicator.getResult();

        const resMACD = new Big(results.macd[index]);
        const resSignal = new Big(results.signal[index]);
        const resDiff = new Big(results.diff[index]);

        expect(macd.toPrecision(12)).toEqual(resMACD.toPrecision(12));
        expect(signal.toPrecision(12)).toEqual(resSignal.toPrecision(12));
        expect(diff.toPrecision(12)).toEqual(resDiff.toPrecision(12));
      });
    });

    it('throws an error when there is not enough input data', () => {
      const indicator = new MACD({longInterval: 26, shortInterval: 12, signalInterval: 9, useDEMA: true});
      expect(() => indicator.getResult()).toThrowError();
    });
  });

  describe('isStable', () => {
    it('knows when it can return reliable data', () => {
      const longInterval = 18;
      const indicator = new MACD({longInterval, shortInterval: 9, signalInterval: 9, useDEMA: false});

      const mockedPrices = [
        new Big('0.00019040'),
        new Big('0.00019071'),
        new Big('0.00019198'),
        new Big('0.00019220'),
        new Big('0.00019214'),
        new Big('0.00019205'),
        new Big('0.00019214'),
        new Big('0.00019222'),
        new Big('0.00019144'),
        new Big('0.00019128'),
        new Big('0.00019159'),
        new Big('0.00019143'),
        new Big('0.00019199'),
        new Big('0.00019214'),
        new Big('0.00019119'),
        new Big('0.00019202'),
        new Big('0.00019220'),
        new Big('0.00019207'),
      ];

      expect(mockedPrices.length).toBe(longInterval);
      expect(indicator.isStable()).toBe(false);

      mockedPrices.forEach(price => indicator.update(price));

      expect(indicator.isStable()).toBe(true);
    });
  });
});
