import {FasterSMA, NotEnoughDataError} from '../index.js';
import {describe} from 'vitest';

describe('SMA', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const sma = new FasterSMA(3);
      sma.add(1);
      sma.add(2);
      expect(sma.prices.length).toBe(2);
      sma.add(3);
      expect(sma.prices.length).toBe(3);
      sma.add(4);
      expect(sma.prices.length).toBe(3);
      sma.add(5);
      expect(sma.prices.length).toBe(3);
      sma.add(6);
      expect(sma.prices.length).toBe(3);
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const interval = 2;

      const fasterSMA = new FasterSMA(interval);

      fasterSMA.add(20);
      fasterSMA.add(30);

      // Add the latest value
      const latestValue = 40;
      const latestResult = '35.00';
      const latestLow = '25.00';
      const latestHigh = '35.00';

      fasterSMA.add(latestValue);
      expect(fasterSMA.getResultOrThrow().toFixed(2)).toBe(latestResult);
      expect(fasterSMA.lowest?.toFixed(2)).toBe(latestLow);
      expect(fasterSMA.highest?.toFixed(2)).toBe(latestHigh);

      // Replace the latest value with some other value
      const someOtherValue = 82;
      const otherResult = '56.00';
      const otherLow = '25.00';
      const otherHigh = '56.00';

      fasterSMA.replace(someOtherValue);
      expect(fasterSMA.getResultOrThrow().toFixed(2)).toBe(otherResult);
      expect(fasterSMA.lowest?.toFixed(2)).toBe(otherLow);
      expect(fasterSMA.highest?.toFixed(2)).toBe(otherHigh);

      // Replace the other value with the latest value
      fasterSMA.replace(latestValue);
      expect(fasterSMA.getResultOrThrow().toFixed(2)).toBe(latestResult);
      expect(fasterSMA.lowest?.toFixed(2)).toBe(latestLow);
      expect(fasterSMA.highest?.toFixed(2)).toBe(latestHigh);
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const prices = [1, 2, 3, 4, 5];
      const interval = 5;

      const fasterSMA = new FasterSMA(interval);
      fasterSMA.updates(prices, false);

      expect(fasterSMA.getResultOrThrow().toFixed()).toBe('3');
    });
  });

  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const sma = new FasterSMA(3);
      sma.add(40);
      sma.add(30);
      expect(sma.isStable).toBe(false);
      sma.add(20);
      expect(sma.isStable).toBe(true);
      sma.add(10);
      sma.add(30);
      expect(sma.getResultOrThrow().valueOf()).toBe('20');
      expect(sma.lowest?.toFixed(2)).toBe('20.00');
      expect(sma.highest?.toFixed(2)).toBe('30.00');
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the moving average based on the last 5 prices', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L359-L361
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
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
      ] as const;

      const interval = 5;
      const fasterSMA = new FasterSMA(interval);

      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const fasterResult = fasterSMA.add(price);

        if (fasterResult) {
          const expected = expectations[i - (interval - 1)];
          expect(fasterResult.toFixed(3)).toBe(expected);
        }
      }

      expect(fasterSMA.isStable).toBe(true);
      expect(fasterSMA.getRequiredInputs()).toBe(interval);
      expect(fasterSMA.getResultOrThrow()).toBe(86.804);
      expect(fasterSMA.highest?.toFixed(2)).toBe('86.80');
      expect(fasterSMA.lowest?.toFixed(2)).toBe('82.43');
    });

    it('throws an error when there is not enough input data', () => {
      const sma = new FasterSMA(26);

      try {
        sma.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }

      const fasterSMA = new FasterSMA(5);

      try {
        fasterSMA.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
