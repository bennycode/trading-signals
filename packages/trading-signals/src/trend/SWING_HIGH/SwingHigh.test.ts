import {NotEnoughDataError} from '../../error/NotEnoughDataError.js';
import {SwingLookback} from '../SWING_LOW/SwingLookback.js';
import {SwingHigh} from './SwingHigh.js';

describe('SwingHigh', () => {
  describe('add', () => {
    it('confirms a swing high once lookback candles on each side show lower highs', () => {
      const candles = [
        {high: 4, low: 2},
        {high: 6, low: 4},
        {high: 9, low: 7},
        {high: 7, low: 5},
        {high: 5, low: 3},
      ] as const;
      const expectations = [null, null, null, null, 9] as const;
      const swingHigh = new SwingHigh({lookback: SwingLookback.BILL_WILLIAMS});

      candles.forEach((candle, i) => {
        const result = swingHigh.add(candle);
        expect(result).toBe(expectations[i]);
      });

      expect(swingHigh.isStable).toBe(true);
      expect(swingHigh.getResultOrThrow()).toBe(9);
    });

    it('detects multiple swing highs across a longer series', () => {
      const candles = [
        {high: 2, low: 1},
        {high: 4, low: 3},
        {high: 9, low: 8},
        {high: 6, low: 5},
        {high: 3, low: 2},
        {high: 1, low: 0},
        {high: 5, low: 4},
        {high: 12, low: 11},
        {high: 7, low: 6},
        {high: 5, low: 4},
      ] as const;
      const swingHigh = new SwingHigh({lookback: SwingLookback.BILL_WILLIAMS});
      const detected: number[] = [];

      candles.forEach(candle => {
        const result = swingHigh.add(candle);

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([9, 12]);
    });

    it('ignores candidates when neighbors have an equal high (strict comparison)', () => {
      const candles = [
        {high: 4, low: 2},
        {high: 6, low: 4},
        {high: 9, low: 7},
        {high: 9, low: 7},
        {high: 5, low: 3},
      ] as const;
      const swingHigh = new SwingHigh({lookback: SwingLookback.BILL_WILLIAMS});

      candles.forEach(candle => {
        swingHigh.add(candle);
      });

      expect(swingHigh.getResult()).toBeNull();
    });

    it('works with the chartist lookback of 5 candles per side', () => {
      const candles = [
        {high: 10, low: 8},
        {high: 11, low: 9},
        {high: 12, low: 10},
        {high: 13, low: 11},
        {high: 14, low: 12},
        {high: 20, low: 18},
        {high: 13, low: 11},
        {high: 12, low: 10},
        {high: 11, low: 9},
        {high: 10, low: 8},
        {high: 9, low: 7},
      ] as const;
      const swingHigh = new SwingHigh({lookback: SwingLookback.CHARTISTS});
      const detected: number[] = [];

      candles.forEach(candle => {
        const result = swingHigh.add(candle);

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([20]);
    });

    it('throws when accessed before enough data has been added', () => {
      const swingHigh = new SwingHigh({lookback: SwingLookback.BILL_WILLIAMS});

      swingHigh.add({high: 4, low: 2});
      swingHigh.add({high: 6, low: 4});

      expect(() => swingHigh.getResultOrThrow()).toThrow(NotEnoughDataError);
      expect(swingHigh.isStable).toBe(false);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const swingHigh = new SwingHigh({lookback: SwingLookback.BILL_WILLIAMS});

      swingHigh.add({high: 4, low: 2});
      swingHigh.add({high: 6, low: 4});
      swingHigh.add({high: 9, low: 7});
      swingHigh.add({high: 7, low: 5});

      const originalValue = {high: 5, low: 3} as const;
      const replacedValue = {high: 10, low: 8} as const;

      const originalResult = swingHigh.add(originalValue);
      const replacedResult = swingHigh.replace(replacedValue);

      expect(originalResult).toBe(9);
      expect(replacedResult).toBeNull();

      const restoredResult = swingHigh.replace(originalValue);

      expect(restoredResult).toBe(9);
    });
  });

  describe('getRequiredInputs', () => {
    it('returns the amount of required data needed for a calculation', () => {
      const swingHigh = new SwingHigh({lookback: SwingLookback.BILL_WILLIAMS});
      expect(swingHigh.getRequiredInputs()).toBe(5);
    });

    it('scales with the configured lookback', () => {
      const swingHigh = new SwingHigh({lookback: SwingLookback.CHARTISTS});
      expect(swingHigh.getRequiredInputs()).toBe(11);
    });
  });
});
