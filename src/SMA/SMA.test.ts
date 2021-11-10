import Big from 'big.js';
import {NotEnoughDataError, SMA, FasterSMA} from '..';

import prices from '../test/fixtures/prices.json';
import testData from '../test/fixtures/SMA/LTC-USDT-1m.json';
import results from '../test/fixtures/SMA/results.json';

const SMA10results = results.weight_10;
const SMA12results = results.weight_12;
const SMA26results = results.weight_26;

describe('SMA', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const sma = new SMA(3);
      sma.update(1);
      sma.update(2);
      expect(sma.prices.length).toBe(2);
      sma.update(3);
      expect(sma.prices.length).toBe(3);
      sma.update(4);
      expect(sma.prices.length).toBe(3);
      sma.update(5);
      expect(sma.prices.length).toBe(3);
      sma.update(6);
      expect(sma.prices.length).toBe(3);
    });
  });

  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const sma = new SMA(3);
      sma.update(40);
      sma.update(30);
      expect(sma.isStable).toBeFalse();
      sma.update(20);
      expect(sma.isStable).toBeTrue();
      sma.update('10');
      sma.update(new Big(30));
      expect(sma.getResult().valueOf()).toBe('20');
      expect(sma.lowest!.toFixed(2)).toBe('20.00');
      expect(sma.highest!.toFixed(2)).toBe('30.00');
    });
  });

  describe('getResult', () => {
    it('matches the moving average logic from Binance exchange', () => {
      const shortInterval = 20;
      const twentyCandles = testData.slice(Math.max(testData.length - shortInterval, 1));
      const short = new SMA(shortInterval);
      twentyCandles.forEach(candle => {
        short.update(new Big(candle.close));
      });
      expect(short.getResult()!.toFixed(8)).toBe('85.78650000');

      const longInterval = 40;
      const fourtyCandles = testData.slice(Math.max(testData.length - longInterval, 1));
      const long = new SMA(longInterval);
      fourtyCandles.forEach(candle => {
        long.update(new Big(candle.close));
      });
      expect(long.getResult()!.toFixed(8)).toBe('85.95125000');
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
      expect(sma.lowest!.toFixed(2)).toBe('52.50');
      expect(sma.highest!.toFixed(2)).toBe('52.50');
    });

    it('calculates SMAs with window length 12', () => {
      const interval = 12;
      const sma = new SMA(interval);
      prices.slice(0, interval).forEach(price => sma.update(new Big(price)));
      const actual = sma.getResult();
      const expected = new Big(SMA12results[interval - 1]);
      expect(actual.toPrecision(12)).toEqual(expected.toPrecision(12));
      expect(sma.lowest!.toFixed(2)).toBe('57.58');
      expect(sma.highest!.toFixed(2)).toBe('57.58');
    });

    it('calculates SMAs with window length 26', () => {
      const interval = 26;
      const sma = new SMA(interval);
      prices.slice(0, interval).forEach(price => sma.update(new Big(price)));
      const actual = sma.getResult();
      const expected = new Big(SMA26results[interval - 1]);
      expect(actual.toPrecision(12)).toEqual(expected.toPrecision(12));
      expect(sma.lowest!.toFixed(2)).toBe('51.15');
      expect(sma.highest!.toFixed(2)).toBe('51.15');
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

describe('FasterSMA', () => {
  describe('getResult', () => {
    it('calculates the moving average based on the last 5 prices', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L359-L361
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];
      const expectations = [
        '82.426',
        '82.738',
        '83.094',
        '83.318',
        '83.628',
        '83.778',
        '84.254',
        '84.994',
        '85.574',
        '86.218',
        '86.804',
      ];
      const sma = new FasterSMA(5);
      for (const price of prices) {
        const actual = sma.update(price);
        if (actual) {
          const expected = expectations.shift()!;
          expect(actual.toFixed(3)).toBe(expected);
        }
      }
      expect(sma.isStable).toBeTrue();
      expect(sma.getResult()).toBe(86.804);
    });

    it('throws an error when there is not enough input data', () => {
      const sma = new FasterSMA(5);

      try {
        sma.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
