import {FasterRMA, NotEnoughDataError} from '../index.js';
import {describe} from 'vitest';

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
      const rma = new FasterRMA(interval);
      const rmaWithReplace = new FasterRMA(interval);

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
      const fasterRMA = new FasterRMA(interval);
      fasterRMA.add(81.59);
      fasterRMA.add(81.06);
      fasterRMA.add(82.87);
      fasterRMA.add(83.0);

      // Add the latest value
      const latestValue = 90;
      const latestResult = '83.61';
      const latestLow = '81.48';
      const latestHigh = '83.61';

      fasterRMA.add(latestValue);
      expect(fasterRMA.getResultOrThrow()?.toFixed(2)).toBe(latestResult);
      expect(fasterRMA.lowest?.toFixed(2)).toBe(latestLow);
      expect(fasterRMA.highest?.toFixed(2)).toBe(latestHigh);

      // Replace the latest value with some other value
      const someOtherValue = 830.61;
      const otherResult = '231.73';
      const otherLow = '81.48';
      const otherHigh = '231.73';

      fasterRMA.replace(someOtherValue);
      expect(fasterRMA.getResultOrThrow()?.toFixed(2)).toBe(otherResult);
      expect(fasterRMA.lowest?.toFixed(2)).toBe(otherLow);
      expect(fasterRMA.highest?.toFixed(2)).toBe(otherHigh);

      // Replace the other value with the latest value
      fasterRMA.replace(latestValue);
      expect(fasterRMA.getResultOrThrow()?.toFixed(2)).toBe(latestResult);
      expect(fasterRMA.lowest?.toFixed(2)).toBe(latestLow);
      expect(fasterRMA.highest?.toFixed(2)).toBe(latestHigh);
    });

    it('will simply add prices when there are no prices to replace', () => {
      const rma = new FasterRMA(5);
      rma.update(prices[0], true);
      rma.add(prices[1]);
      rma.add(prices[2]);
      rma.add(prices[3]);
      rma.add(prices[4]);
      expect(rma.getResultOrThrow().toFixed(2)).toBe('82.33');

      const fasterRMA = new FasterRMA(5);
      fasterRMA.update(prices[0], true);
      fasterRMA.add(prices[1]);
      fasterRMA.add(prices[2]);
      fasterRMA.add(prices[3]);
      fasterRMA.add(prices[4]);
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Exponential Moving Average over a period of 5', () => {
      const interval = 5;
      const fasterRMA = new FasterRMA(interval);
      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        fasterRMA.add(price);
        if (fasterRMA.isStable) {
          const expected = expectations[i - (interval - 1)];
          expect(fasterRMA.getResultOrThrow().toFixed(2)).toBe(expected);
        }
      }
      expect(fasterRMA.getResultOrThrow().toFixed(2)).toBe('85.83');
    });

    it('throws an error when there is not enough input data', () => {
      const rma = new FasterRMA(10);

      try {
        rma.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
        expect(rma.isStable).toBe(false);
      }

      const fasterRMA = new FasterRMA(10);

      try {
        fasterRMA.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
        expect(fasterRMA.isStable).toBe(false);
      }
    });
  });
});
