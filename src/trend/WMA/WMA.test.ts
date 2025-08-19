import {WMA, NotEnoughDataError} from '../../index.js';

describe('WMA', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const wma = new WMA(3);
      wma.add(1);
      wma.add(2);
      expect(wma.prices.length).toBe(2);
      wma.add(3);
      expect(wma.prices.length).toBe(3);
      wma.add(4);
      expect(wma.prices.length).toBe(3);
      wma.add(5);
      expect(wma.prices.length).toBe(3);
      wma.add(6);
      expect(wma.prices.length).toBe(3);
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const interval = 3;

      const wma = new WMA(interval);

      wma.add(11);
      wma.add(12);
      wma.add(13);
      wma.add(14);

      // Add the latest value
      const latestValue = 15;
      const latestResult = '14.33';

      wma.add(latestValue);
      expect(wma.getResultOrThrow().toFixed(2)).toBe(latestResult);

      // Replace the latest value with some other value
      const someOtherValue = 1000;
      const otherResult = '506.83';

      wma.replace(someOtherValue);
      expect(wma.getResultOrThrow().toFixed(2)).toBe(otherResult);

      // Replace the other value with the latest value
      wma.replace(latestValue);
      expect(wma.getResultOrThrow().toFixed(2)).toBe(latestResult);
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const prices = [30, 60, 90, 60, 90];
      const interval = 5;

      const wma = new WMA(interval);
      wma.updates(prices, false);
      expect(wma.getResultOrThrow().toFixed()).toBe('74');
    });
  });

  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const wma = new WMA(3);
      wma.add(30);
      wma.add(60);
      expect(wma.isStable).toBe(false);
      wma.add(90);
      expect(wma.isStable).toBe(true);
      wma.add(120);
      wma.add(60);
      expect(wma.getResultOrThrow()).toBe(85);
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the moving average based on the last 5 prices', () => {
      const prices = [91, 90, 89, 88, 90] as const;
      const expectations = ['89.33'] as const;
      const wma = new WMA(5);
      const offset = wma.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = wma.add(price);

        if (result) {
          const expected = expectations[i - offset];
          expect(result.toFixed(2)).toBe(expected);
        }
      });

      expect(wma.isStable).toBe(true);
    });

    it('calculates the moving average based on the last 5 prices', () => {
      const prices = [91, 90, 89, 88, 90] as const;
      const expectations = ['89.33'] as const;

      const wma = new WMA(5);
      const offset = wma.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = wma.add(price);

        if (result) {
          const expected = expectations[i - offset];
          expect(result.toFixed(2)).toBe(expected);
        }
      });

      expect(wma.isStable).toBe(true);
    });

    it('throws an error when there is not enough input data', () => {
      const wma = new WMA(5);

      try {
        wma.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
