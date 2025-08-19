import {RMA, NotEnoughDataError} from '../../index.js';

describe('RMA', () => {
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = [
    '82.33',
    '82.49',
    '82.56',
    '82.85',
    '83.19',
    '83.42',
    '83.84',
    '84.38',
    '84.88',
    '85.46',
    '85.83',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;
      const rma = new RMA(interval);
      const rmaWithReplace = new RMA(interval);

      const subset = [prices[0], prices[1], prices[2]];

      rma.updates([...subset, prices[3], prices[4]], false);

      rmaWithReplace.updates([...subset, 8239239], false);
      rmaWithReplace.replace(prices[3]);
      rmaWithReplace.add(prices[4]);

      const actual = rmaWithReplace.getResultOrThrow().toFixed();
      const expected = rma.getResultOrThrow().toFixed();

      expect(actual).toBe(expected);
    });

    it('replaces recently added values', () => {
      const interval = 5;
      const rma = new RMA(interval);

      rma.add(81.59);
      rma.add(81.06);
      rma.add(82.87);
      rma.add(83.0);

      // Add the latest value
      const latestValue = 90;
      const latestResult = '83.61';

      rma.add(latestValue);
      expect(rma.getResultOrThrow()?.toFixed(2)).toBe(latestResult);

      // Replace the latest value with some other value
      const someOtherValue = 830.61;
      const otherResult = '231.73';

      rma.replace(someOtherValue);
      expect(rma.getResultOrThrow()?.toFixed(2)).toBe(otherResult);

      // Replace the other value with the latest value
      rma.replace(latestValue);
      expect(rma.getResultOrThrow()?.toFixed(2)).toBe(latestResult);
    });

    it('will simply add prices when there are no prices to replace', () => {
      const rma = new RMA(5);

      rma.replace(prices[0]);
      rma.add(prices[1]);
      rma.add(prices[2]);
      rma.add(prices[3]);
      rma.add(prices[4]);

      expect(rma.getResultOrThrow().toFixed(2)).toBe('82.33');
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Exponential Moving Average over a period of 5', () => {
      const interval = 5;
      const rma = new RMA(interval);

      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        rma.add(price);

        if (rma.isStable) {
          const expected = expectations[i - (interval - 1)];
          expect(rma.getResultOrThrow().toFixed(2)).toBe(expected);
        }
      }
      expect(rma.getResultOrThrow().toFixed(2)).toBe('85.83');
    });

    it('throws an error when there is not enough input data', () => {
      const rma = new RMA(10);

      try {
        rma.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
        expect(rma.isStable).toBe(false);
      }
    });
  });
});
