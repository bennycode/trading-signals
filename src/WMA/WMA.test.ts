import {Big, FasterWMA, NotEnoughDataError, WMA} from '../index.js';
import {describe} from 'vitest';

describe('WMA', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const wma = new WMA(3);
      const fasterWMA = new FasterWMA(3);
      wma.update(1);
      fasterWMA.update(1);
      wma.update(2);
      fasterWMA.update(2);
      expect(wma.prices.length).toBe(2);
      expect(fasterWMA.prices.length).toBe(2);
      wma.update(3);
      fasterWMA.update(3);
      expect(wma.prices.length).toBe(3);
      expect(fasterWMA.prices.length).toBe(3);
      wma.update(4);
      fasterWMA.update(4);
      expect(wma.prices.length).toBe(3);
      expect(fasterWMA.prices.length).toBe(3);
      wma.update(5);
      fasterWMA.update(5);
      expect(wma.prices.length).toBe(3);
      expect(fasterWMA.prices.length).toBe(3);
      wma.update(6);
      fasterWMA.update(6);
      expect(wma.prices.length).toBe(3);
      expect(fasterWMA.prices.length).toBe(3);
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const interval = 3;

      const wma = new WMA(interval);
      const fasterWMA = new FasterWMA(interval);

      wma.update(11);
      fasterWMA.update(11);
      wma.update(12);
      fasterWMA.update(12);
      wma.update(13);
      fasterWMA.update(13);
      wma.update(14);
      fasterWMA.update(14);

      // Add the latest value
      const latestValue = 15;
      const latestResult = '14.33';
      const latestLow = '12.33';
      const latestHigh = '14.33';

      wma.update(latestValue);
      expect(wma.getResult().toFixed(2)).toBe(latestResult);
      expect(wma.lowest?.toFixed(2)).toBe(latestLow);
      expect(wma.highest?.toFixed(2)).toBe(latestHigh);

      fasterWMA.update(latestValue);
      expect(fasterWMA.getResult().toFixed(2)).toBe(latestResult);
      expect(fasterWMA.lowest?.toFixed(2)).toBe(latestLow);
      expect(fasterWMA.highest?.toFixed(2)).toBe(latestHigh);

      // Replace the latest value with some other value
      const someOtherValue = 1000;
      const otherResult = '506.83';
      const otherLow = '12.33';
      const otherHigh = '506.83';

      wma.replace(someOtherValue);
      expect(wma.getResult().toFixed(2)).toBe(otherResult);
      expect(wma.lowest?.toFixed(2)).toBe(otherLow);
      expect(wma.highest?.toFixed(2), 'new record high').toBe(otherHigh);

      fasterWMA.replace(someOtherValue);
      expect(fasterWMA.getResult().toFixed(2)).toBe(otherResult);
      expect(fasterWMA.lowest?.toFixed(2)).toBe(otherLow);
      expect(fasterWMA.highest?.toFixed(2), 'new record high').toBe(otherHigh);

      // Replace the other value with the latest value
      wma.replace(latestValue);
      expect(wma.getResult().toFixed(2)).toBe(latestResult);
      expect(wma.lowest?.toFixed(2), 'lowest reset').toBe(latestLow);
      expect(wma.highest?.toFixed(2), 'highest reset').toBe(latestHigh);

      fasterWMA.replace(latestValue);
      expect(fasterWMA.getResult().toFixed(2)).toBe(latestResult);
      expect(fasterWMA.lowest?.toFixed(2), 'lowest reset').toBe(latestLow);
      expect(fasterWMA.highest?.toFixed(2), 'highest reset').toBe(latestHigh);
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const prices = [30, 60, 90, 60, 90];
      const interval = 5;

      const wma = new WMA(interval);
      const fasterWMA = new FasterWMA(interval);
      wma.updates(prices);
      fasterWMA.updates(prices);

      expect(wma.getResult().toFixed()).toBe('74');
      expect(fasterWMA.getResult().toFixed()).toBe('74');
    });
  });

  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const wma = new WMA(3);
      wma.update(30);
      wma.update(60);
      expect(wma.isStable).toBe(false);
      wma.update(90);
      expect(wma.isStable).toBe(true);
      wma.update('120');
      wma.update(new Big(60));
      expect(wma.getResult().valueOf()).toBe('85');
      expect(wma.lowest?.toFixed(2)).toBe('70.00');
      expect(wma.highest?.toFixed(2)).toBe('100.00');
    });
  });

  describe('getResult', () => {
    it('calculates the moving average based on the last 5 prices', () => {
      const prices = [91, 90, 89, 88, 90];
      const expectations = ['89.33'];
      const wma = new WMA(5);
      const fasterWMA = new FasterWMA(5);

      for (const price of prices) {
        const result = wma.update(price);
        const fasterResult = fasterWMA.update(price);

        if (result && fasterResult) {
          const expected = expectations.shift()!;
          expect(result.toFixed(2)).toBe(expected);
          expect(fasterResult.toFixed(2)).toBe(expected);
        }
      }

      expect(wma.isStable).toBe(true);
      expect(fasterWMA.isStable).toBe(true);
    });

    it('throws an error when there is not enough input data', () => {
      const wma = new WMA(26);

      try {
        wma.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }

      const fasterWMA = new FasterWMA(5);

      try {
        fasterWMA.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
