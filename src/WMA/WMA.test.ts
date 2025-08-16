import {FasterWMA, NotEnoughDataError} from '../index.js';

describe('WMA', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const fasterWMA = new FasterWMA(3);
      fasterWMA.add(1);
      fasterWMA.add(2);
      expect(fasterWMA.prices.length).toBe(2);
      fasterWMA.add(3);
      expect(fasterWMA.prices.length).toBe(3);
      fasterWMA.add(4);
      expect(fasterWMA.prices.length).toBe(3);
      fasterWMA.add(5);
      expect(fasterWMA.prices.length).toBe(3);
      fasterWMA.add(6);
      expect(fasterWMA.prices.length).toBe(3);
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const interval = 3;

      const fasterWMA = new FasterWMA(interval);

      fasterWMA.add(11);
      fasterWMA.add(12);
      fasterWMA.add(13);
      fasterWMA.add(14);

      // Add the latest value
      const latestValue = 15;
      const latestResult = '14.33';
      const latestLow = '12.33';
      const latestHigh = '14.33';

      fasterWMA.add(latestValue);
      expect(fasterWMA.getResultOrThrow().toFixed(2)).toBe(latestResult);
      expect(fasterWMA.lowest?.toFixed(2)).toBe(latestLow);
      expect(fasterWMA.highest?.toFixed(2)).toBe(latestHigh);

      // Replace the latest value with some other value
      const someOtherValue = 1000;
      const otherResult = '506.83';
      const otherLow = '12.33';
      const otherHigh = '506.83';

      fasterWMA.replace(someOtherValue);
      expect(fasterWMA.getResultOrThrow().toFixed(2)).toBe(otherResult);
      expect(fasterWMA.lowest?.toFixed(2)).toBe(otherLow);
      expect(fasterWMA.highest?.toFixed(2), 'new record high').toBe(otherHigh);

      // Replace the other value with the latest value
      fasterWMA.replace(latestValue);
      expect(fasterWMA.getResultOrThrow().toFixed(2)).toBe(latestResult);
      expect(fasterWMA.lowest?.toFixed(2), 'lowest reset').toBe(latestLow);
      expect(fasterWMA.highest?.toFixed(2), 'highest reset').toBe(latestHigh);
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const prices = [30, 60, 90, 60, 90];
      const interval = 5;

      const fasterWMA = new FasterWMA(interval);
      fasterWMA.updates(prices, false);
      expect(fasterWMA.getResultOrThrow().toFixed()).toBe('74');
    });
  });

  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const wma = new FasterWMA(3);
      wma.add(30);
      wma.add(60);
      expect(wma.isStable).toBe(false);
      wma.add(90);
      expect(wma.isStable).toBe(true);
      wma.add(120);
      wma.add(60);
      expect(wma.getResultOrThrow().valueOf()).toBe('85');
      expect(wma.lowest?.toFixed(2)).toBe('70.00');
      expect(wma.highest?.toFixed(2)).toBe('100.00');
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the moving average based on the last 5 prices', () => {
      const prices = [91, 90, 89, 88, 90];
      const expectations = ['89.33'];
      const fasterWMA = new FasterWMA(5);

      for (const price of prices) {
        const fasterResult = fasterWMA.add(price);

        if (fasterResult) {
          const expected = expectations.shift()!;
          expect(fasterResult.toFixed(2)).toBe(expected);
        }
      }

      expect(fasterWMA.isStable).toBe(true);
    });

    it('throws an error when there is not enough input data', () => {
      const fasterWMA = new FasterWMA(5);

      try {
        fasterWMA.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
