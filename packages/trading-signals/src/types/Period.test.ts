import {NotEnoughDataError} from '../error/NotEnoughDataError.js';
import {Period} from './Period.js';

describe('Period', () => {
  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;
      const expectedLow = '30';
      const expectedHigh = '70';

      const period = new Period(interval);
      const periodWithReplace = new Period(interval);

      const subset = [30, 40, 50, 60];
      period.updates([...subset, 70], false);
      periodWithReplace.updates([...subset, 90], false);
      periodWithReplace.replace(70);
      expect(periodWithReplace.lowest?.toFixed(0)).toBe(expectedLow);
      expect(periodWithReplace.highest?.toFixed(0)).toBe(expectedHigh);
    });
  });

  describe('getResultOrThrow', () => {
    it('returns the highest and lowest value of the current period', () => {
      const prices = [72, 1337] as const;
      const interval = 2;

      const period = new Period(interval);
      period.updates(prices, false);
      const {highest, lowest} = period.getResultOrThrow();

      expect(lowest).toBe(72);
      expect(highest).toBe(1337);
      expect(period.lowest).toBe(72);
      expect(period.highest).toBe(1337);
    });

    it('throws an error when there is not enough input data', () => {
      const period = new Period(2);
      try {
        period.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('returns the lowest and highest value during the period when it is stable', () => {
      // Test data verified with:
      // https://tulipindicators.org/min
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const lowest = [
        '81.06',
        '81.06',
        '82.84',
        '82.84',
        '82.84',
        '82.84',
        '82.84',
        '83.99',
        '84.36',
        '84.36',
        '85.53',
      ] as const;
      const interval = 5;
      const period = new Period(interval);
      const offset = period.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        period.add(price);
        if (period.isStable) {
          const expected = lowest[i - offset];
          expect(period.lowest?.toFixed(2)).toBe(expected);
        }
      });

      expect(period.highest?.toFixed(2)).toBe('87.77');
    });
  });
});
