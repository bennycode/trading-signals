import {FasterPeriod, Period} from './Period';

describe('Period', () => {
  describe('getResult', () => {
    it('returns the highest and lowest value of the current period', () => {
      const period = new Period(2);
      period.update(72);
      period.update(1337);
      const {highest, lowest} = period.getResult();
      expect(lowest.valueOf()).toBe('72');
      expect(highest.valueOf()).toBe('1337');

      const fasterPeriod = new FasterPeriod(2);
      fasterPeriod.update(72);
      fasterPeriod.update(1337);
      const {highest: fastestHighest, lowest: fastestLowest} = fasterPeriod.getResult();
      expect(fastestLowest).toBe(72);
      expect(fastestHighest).toBe(1337);
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
      const period = new Period(5);
      const fasterPeriod = new FasterPeriod(5);
      for (const price of prices) {
        period.update(price);
        fasterPeriod.update(price);
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
