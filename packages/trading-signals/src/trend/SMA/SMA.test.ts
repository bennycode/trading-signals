import {SMA, NotEnoughDataError} from '../../index.js';

describe('SMA', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const sma = new SMA(3);
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
      const sma = new SMA(interval);

      sma.add(20);
      sma.add(30);

      // Add the latest value
      const latestValue = 40;
      const latestResult = '35.00';

      sma.add(latestValue);
      expect(sma.getResultOrThrow().toFixed(2)).toBe(latestResult);

      // Replace the latest value with some other value
      const someOtherValue = 82;
      const otherResult = '56.00';

      sma.replace(someOtherValue);
      expect(sma.getResultOrThrow().toFixed(2)).toBe(otherResult);

      // Replace the other value with the latest value
      sma.replace(latestValue);
      expect(sma.getResultOrThrow().toFixed(2)).toBe(latestResult);
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const prices = [1, 2, 3, 4, 5];
      const interval = 5;

      const sma = new SMA(interval);
      sma.updates(prices, false);

      expect(sma.getResultOrThrow().toFixed()).toBe('3');
    });
  });

  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const sma = new SMA(3);
      sma.add(40);
      sma.add(30);
      expect(sma.isStable).toBe(false);
      sma.add(20);
      expect(sma.isStable).toBe(true);
      sma.add(10);
      sma.add(30);
      expect(sma.getResultOrThrow()).toBe(20);
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
      const sma = new SMA(interval);

      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const result = sma.add(price);

        if (result) {
          const expected = expectations[i - (interval - 1)];
          expect(result.toFixed(3)).toBe(expected);
        }
      }

      expect(sma.isStable).toBe(true);
      expect(sma.getRequiredInputs()).toBe(interval);
      expect(sma.getResultOrThrow()).toBe(86.804);
    });

    it('throws an error when there is not enough input data', () => {
      const sma = new SMA(5);

      try {
        sma.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
