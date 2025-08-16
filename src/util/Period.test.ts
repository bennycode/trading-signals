import {NotEnoughDataError} from '../error/NotEnoughDataError.js';
import {FasterPeriod} from './Period.js';

describe('Period', () => {
  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;
      const expectedLow = '30';
      const expectedHigh = '70';

      const period = new FasterPeriod(interval);
      const periodWithReplace = new FasterPeriod(interval);
      const fasterPeriodWithReplace = new FasterPeriod(interval);

      const subset = [30, 40, 50, 60];
      period.updates([...subset, 70], false);
      periodWithReplace.updates([...subset, 90], false);
      periodWithReplace.replace(70);
      fasterPeriodWithReplace.updates([...subset, 90], false);
      fasterPeriodWithReplace.replace(70);

      expect(periodWithReplace.lowest?.toFixed()).toBe(expectedLow);
      expect(periodWithReplace.highest?.toFixed()).toBe(expectedHigh);
      expect(fasterPeriodWithReplace.highest?.toFixed()).toBe(expectedHigh);
    });
  });

  describe('getResultOrThrow', () => {
    it('returns the highest and lowest value of the current period', () => {
      const values = [72, 1337];
      const interval = 2;
      const period = new FasterPeriod(interval);
      period.updates(values, false);
      const {highest, lowest} = period.getResultOrThrow();
      expect(lowest.valueOf()).toBe('72');
      expect(highest.valueOf()).toBe('1337');

      expect(period.lowest?.valueOf()).toBe('72');
      expect(period.highest?.valueOf()).toBe('1337');

      const fasterPeriod = new FasterPeriod(interval);
      fasterPeriod.updates(values, false);
      const {highest: fastestHighest, lowest: fastestLowest} = fasterPeriod.getResultOrThrow();
      expect(fastestLowest).toBe(72);
      expect(fastestHighest).toBe(1337);
    });

    it('throws an error when there is not enough input data', () => {
      const period = new FasterPeriod(2);
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
      ];
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
      ];
      const interval = 5;
      const period = new FasterPeriod(interval);
      const fasterPeriod = new FasterPeriod(interval);
      for (const price of prices) {
        period.add(price);
        fasterPeriod.add(price);
        if (period.isStable) {
          const expected = lowest.shift();
          expect(period.lowest?.toFixed(2)).toBe(expected);
          expect(fasterPeriod.lowest?.toFixed(2)).toBe(expected);
        }
      }
      expect(period.highest?.toFixed(2)).toBe('87.77');
      expect(fasterPeriod.highest?.toFixed(2)).toBe('87.77');
    });
  });
});
