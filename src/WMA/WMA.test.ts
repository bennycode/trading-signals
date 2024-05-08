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

  describe('update', () => {
    it('can replace recently added values', () => {
      const interval = 3;

      const wma = new WMA(interval);
      const fasterWMA = new FasterWMA(interval);

      wma.update(30);
      fasterWMA.update(30);

      wma.update(60);
      fasterWMA.update(60);

      wma.update(90);
      fasterWMA.update(90);

      expect(wma.getResult().toFixed()).toBe('70');
      expect(fasterWMA.getResult().toFixed()).toBe('70');

      wma.update(60, true);
      fasterWMA.update(60, true);

      expect(wma.getResult().toFixed()).toBe('55');
      expect(fasterWMA.getResult().toFixed()).toBe('55');
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
