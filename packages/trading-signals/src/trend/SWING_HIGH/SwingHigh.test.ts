import {NotEnoughDataError} from '../../error/NotEnoughDataError.js';
import {SwingLookback} from '../SWING_LOW/SwingLookback.js';
import {SwingHigh} from './SwingHigh.js';

describe('SwingHigh', () => {
  describe('add', () => {
    it('confirms a swing high once lookback candles on each side show lower highs', () => {
      const highs = [4, 6, 9, 7, 5] as const;
      const lows = highs.map(high => high - 2);
      const expectations = [null, null, null, null, 9] as const;
      const swingHigh = new SwingHigh({lookback: SwingLookback.BILL_WILLIAMS});

      highs.forEach((high, i) => {
        const result = swingHigh.add({high, low: lows[i]});
        expect(result).toBe(expectations[i]);
      });

      expect(swingHigh.isStable).toBe(true);
      expect(swingHigh.getResultOrThrow()).toBe(9);
    });

    it('detects multiple swing highs across a longer series', () => {
      const highs = [2, 4, 9, 6, 3, 1, 5, 12, 7, 5] as const;
      const lows = highs.map(high => high - 1);
      const swingHigh = new SwingHigh({lookback: SwingLookback.BILL_WILLIAMS});
      const detected: number[] = [];

      highs.forEach((high, i) => {
        const result = swingHigh.add({high, low: lows[i]});

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([9, 12]);
    });

    it('ignores candidates when neighbors have an equal high (strict comparison)', () => {
      const highs = [4, 6, 9, 9, 5] as const;
      const lows = highs.map(high => high - 2);
      const swingHigh = new SwingHigh({lookback: SwingLookback.BILL_WILLIAMS});

      highs.forEach((high, i) => {
        swingHigh.add({high, low: lows[i]});
      });

      expect(swingHigh.getResult()).toBeNull();
    });

    it('works with the chartist lookback of 5 candles per side', () => {
      const highs = [10, 11, 12, 13, 14, 20, 13, 12, 11, 10, 9] as const;
      const lows = highs.map(high => high - 2);
      const swingHigh = new SwingHigh({lookback: SwingLookback.CHARTISTS});
      const detected: number[] = [];

      highs.forEach((high, i) => {
        const result = swingHigh.add({high, low: lows[i]});

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
