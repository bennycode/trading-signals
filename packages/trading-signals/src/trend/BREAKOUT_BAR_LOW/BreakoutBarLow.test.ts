import {NotEnoughDataError} from '../../error/NotEnoughDataError.js';
import {BreakoutBarLow} from './BreakoutBarLow.js';

describe('BreakoutBarLow', () => {
  describe('add', () => {
    it('emits the low of a candle whose high exceeds all prior highs in the lookback window', () => {
      const candles = [
        {high: 10, low: 8},
        {high: 12, low: 10},
        {high: 11, low: 9},
        {high: 15, low: 11},
      ] as const;
      const breakout = new BreakoutBarLow({lookback: 3});
      const results: (number | null)[] = [];

      candles.forEach(candle => {
        results.push(breakout.add(candle));
      });

      expect(results).toEqual([null, null, null, 11]);
      expect(breakout.getResultOrThrow()).toBe(11);
    });

    it('detects successive breakout bars as new highs are made', () => {
      const candles = [
        {high: 10, low: 8},
        {high: 12, low: 10},
        {high: 11, low: 9},
        {high: 15, low: 11},
        {high: 13, low: 10},
        {high: 16, low: 12},
        {high: 14, low: 11},
        {high: 20, low: 15},
      ] as const;
      const breakout = new BreakoutBarLow({lookback: 3});
      const detected: number[] = [];

      candles.forEach(candle => {
        const result = breakout.add(candle);

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([11, 12, 15]);
    });

    it('returns null when the current high ties the prior max (strict comparison)', () => {
      const candles = [
        {high: 10, low: 8},
        {high: 12, low: 10},
        {high: 11, low: 9},
        {high: 12, low: 10},
      ] as const;
      const breakout = new BreakoutBarLow({lookback: 3});

      candles.forEach(candle => {
        breakout.add(candle);
      });

      expect(breakout.getResult()).toBeNull();
    });

    it('throws when accessed before enough data has been added', () => {
      const breakout = new BreakoutBarLow({lookback: 3});

      breakout.add({high: 10, low: 8});
      breakout.add({high: 12, low: 10});

      expect(() => breakout.getResultOrThrow()).toThrow(NotEnoughDataError);
      expect(breakout.isStable).toBe(false);
    });
  });

  describe('replace', () => {
    it('rolls back the stored breakout low when a replacement no longer qualifies as a breakout', () => {
      const breakout = new BreakoutBarLow({lookback: 3});

      breakout.add({high: 10, low: 8});
      breakout.add({high: 12, low: 10});
      breakout.add({high: 11, low: 9});

      const originalValue = {high: 15, low: 11} as const;
      const replacedValue = {high: 11, low: 9} as const;

      const originalResult = breakout.add(originalValue);

      expect(originalResult).toBe(11);
      expect(breakout.getResult()).toBe(11);
      expect(breakout.isStable).toBe(true);

      const replacedResult = breakout.replace(replacedValue);

      expect(replacedResult).toBeNull();
      expect(breakout.getResult()).toBeNull();
      expect(breakout.isStable).toBe(false);

      const restoredResult = breakout.replace(originalValue);

      expect(restoredResult).toBe(11);
      expect(breakout.getResult()).toBe(11);
      expect(breakout.isStable).toBe(true);
    });
  });

  describe('getRequiredInputs', () => {
    it('returns the amount of required data needed for a calculation', () => {
      const breakout = new BreakoutBarLow({lookback: 3});
      expect(breakout.getRequiredInputs()).toBe(4);
    });

    it('scales with the configured lookback', () => {
      const breakout = new BreakoutBarLow({lookback: 20});
      expect(breakout.getRequiredInputs()).toBe(21);
    });
  });
});
