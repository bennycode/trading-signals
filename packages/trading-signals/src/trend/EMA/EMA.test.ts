import {EMA, NotEnoughDataError} from '../../index.js';

describe('EMA', () => {
  // Test data verified with:
  // https://tulipindicators.org/ema
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = [
    '82.71',
    '82.86',
    '82.85',
    '83.23',
    '83.67',
    '83.90',
    '84.44',
    '85.14',
    '85.73',
    '86.41',
    '86.70',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;
      const ema = new EMA(interval);
      const emaWithReplace = new EMA(interval);

      const subset = [prices[0], prices[1], prices[2]];

      ema.updates([...subset, prices[3], prices[4]], false);

      emaWithReplace.updates([...subset, 8239239], false);
      emaWithReplace.replace(prices[3]);
      emaWithReplace.add(prices[4]);

      const actual = emaWithReplace.getResultOrThrow().toFixed();
      const expected = ema.getResultOrThrow().toFixed();

      expect(actual).toBe(expected);
    });

    it('replaces recently added values', () => {
      const interval = 5;
      const ema = new EMA(interval);
      ema.add(81.59);
      ema.add(81.06);
      ema.add(82.87);
      ema.add(83.0);

      // Add the latest value
      const latestValue = 90;
      const latestResult = '84.84';

      ema.add(latestValue);
      expect(ema.getResultOrThrow()?.toFixed(2)).toBe(latestResult);

      // Replace the latest value with some other value
      const someOtherValue = 830.61;
      const otherResult = '331.71';

      ema.replace(someOtherValue);
      expect(ema.getResultOrThrow()?.toFixed(2)).toBe(otherResult);

      // Replace the other value with the latest value
      ema.replace(latestValue);
      expect(ema.getResultOrThrow()?.toFixed(2)).toBe(latestResult);
    });

    it('will simply add prices when there are no prices to replace', () => {
      const ema = new EMA(5);
      ema.replace(prices[0]);
      ema.add(prices[1]);
      ema.add(prices[2]);
      ema.add(prices[3]);
      ema.add(prices[4]);
      expect(ema.getResultOrThrow().toFixed(2)).toBe('82.71');
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Exponential Moving Average over a period of 5', () => {
      const interval = 5;
      const ema = new EMA(interval);

      expect(ema.getRequiredInputs()).toBe(interval);

      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        ema.add(price);
        if (ema.isStable) {
          const expected = expectations[i - (interval - 1)];
          expect(ema.getResultOrThrow().toFixed(2)).toBe(expected);
        }
      }

      expect(ema.getResultOrThrow().toFixed(2)).toBe('86.70');
    });

    it('throws an error when there is not enough input data', () => {
      const ema = new EMA(10);

      try {
        ema.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
        expect(ema.isStable).toBe(false);
      }
    });
  });
});
