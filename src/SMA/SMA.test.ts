import Big from 'big.js';
import {NotEnoughDataError, SMA} from '..';

import prices from '../test/fixtures/prices.json';
import testData from '../test/fixtures/SMA/LTC-USDT-1m.json';
import results from '../test/fixtures/SMA/results.json';

const SMA10results = results.weight_10;
const SMA12results = results.weight_12;
const SMA26results = results.weight_26;

describe('SMA', () => {
  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const sma = new SMA(3);
      sma.update(40);
      sma.update(30);
      expect(sma.isStable).toBe(false);
      sma.update(20);
      expect(sma.isStable).toBe(true);
      sma.update('10');
      sma.update(new Big(30));
      expect(sma.getResult().valueOf()).toBe('20');
    });
  });

  describe('getResult', () => {
    it('matches the moving average logic from Binance exchange', () => {
      const shortMovingAverageLength = 20;
      const twentyCandles = testData.slice(Math.max(testData.length - shortMovingAverageLength, 1));
      const shortMovingAverage = new SMA(shortMovingAverageLength);
      twentyCandles.forEach(candle => {
        shortMovingAverage.update(new Big(candle.close));
      });
      expect(shortMovingAverage.getResult()!.toFixed(8)).toBe('85.78650000');

      const longMovingAverageLength = 40;
      const fourtyCandles = testData.slice(Math.max(testData.length - longMovingAverageLength, 1));
      const longMovingAverage = new SMA(longMovingAverageLength);
      fourtyCandles.forEach(candle => {
        longMovingAverage.update(new Big(candle.close));
      });
      expect(longMovingAverage.getResult()!.toFixed(8)).toBe('85.95125000');
    });

    it('calculates SMAs with Binance candles', () => {
      const candles = [{close: 17.79}, {close: 17.73}, {close: 17.73}, {close: 17.76}, {close: 17.8}, {close: 17.81}];
      const sma = new SMA(5);

      for (let index = 0; index < 5; index++) {
        const candle = candles[index];
        sma.update(new Big(candle.close));
      }

      expect(sma.getResult()).toEqual(new Big('17.762'));

      const lastCandle = candles[candles.length - 1];
      sma.update(new Big(lastCandle.close));

      expect(sma.getResult()).toEqual(new Big('17.766'));
      // Testing consecutive call
      expect(sma.getResult()).toEqual(new Big('17.766'));
    });

    it('calculates SMAs with window length 10', () => {
      const interval = 10;
      const sma = new SMA(interval);
      prices.slice(0, interval).forEach(price => sma.update(new Big(price)));
      const actual = sma.getResult();
      const expected = new Big(SMA10results[interval - 1]);
      expect(actual.toPrecision(12)).toEqual(expected.toPrecision(12));
    });

    it('calculates SMAs with window length 12', () => {
      const interval = 12;
      const sma = new SMA(interval);
      prices.slice(0, interval).forEach(price => sma.update(new Big(price)));
      const actual = sma.getResult();
      const expected = new Big(SMA12results[interval - 1]);
      expect(actual.toPrecision(12)).toEqual(expected.toPrecision(12));
    });

    it('calculates SMAs with window length 26', () => {
      const interval = 26;
      const sma = new SMA(interval);
      prices.slice(0, interval).forEach(price => sma.update(new Big(price)));
      const actual = sma.getResult();
      const expected = new Big(SMA26results[interval - 1]);
      expect(actual.toPrecision(12)).toEqual(expected.toPrecision(12));
    });

    it('throws an error when there is not enough input data', () => {
      const sma = new SMA(26);

      try {
        sma.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
