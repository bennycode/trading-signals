import {NotEnoughDataError} from '../../error/NotEnoughDataError.js';
import {SwingLookback} from './SwingLookback.js';
import {SwingLow} from './SwingLow.js';

describe('SwingLow', () => {
  describe('add', () => {
    it('confirms a swing low once lookback candles on each side show higher lows', () => {
      const highs = [11, 9, 6, 8, 10] as const;
      const lows = [10, 8, 5, 7, 9] as const;
      const expectations = [null, null, null, null, 5] as const;
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});

      lows.forEach((low, i) => {
        const result = swingLow.add({high: highs[i], low});
        expect(result).toBe(expectations[i]);
      });

      expect(swingLow.isStable).toBe(true);
      expect(swingLow.getResultOrThrow()).toBe(5);
    });

    it('detects multiple swing lows across a longer series', () => {
      const lows = [10, 8, 5, 7, 9, 11, 6, 4, 7, 8] as const;
      const highs = lows.map(low => low + 2);
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});
      const detected: number[] = [];

      lows.forEach((low, i) => {
        const result = swingLow.add({high: highs[i], low});

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([5, 4]);
    });

    it('ignores candidates when neighbors have an equal low (strict comparison)', () => {
      const lows = [10, 8, 5, 5, 9] as const;
      const highs = [11, 9, 6, 6, 10] as const;
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});

      lows.forEach((low, i) => {
        swingLow.add({high: highs[i], low});
      });

      expect(swingLow.getResult()).toBeNull();
    });

    it('works with the chartist lookback of 5 candles per side', () => {
      const lows = [20, 19, 18, 17, 16, 10, 17, 18, 19, 20, 21] as const;
      const highs = lows.map(low => low + 2);
      const swingLow = new SwingLow({lookback: SwingLookback.CHARTISTS});
      const detected: number[] = [];

      lows.forEach((low, i) => {
        const result = swingLow.add({high: highs[i], low});

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([10]);
    });

    it('throws when accessed before enough data has been added', () => {
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});

      swingLow.add({high: 11, low: 10});
      swingLow.add({high: 9, low: 8});

      expect(() => swingLow.getResultOrThrow()).toThrow(NotEnoughDataError);
      expect(swingLow.isStable).toBe(false);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});

      swingLow.add({high: 11, low: 10});
      swingLow.add({high: 9, low: 8});
      swingLow.add({high: 6, low: 5});
      swingLow.add({high: 8, low: 7});

      const originalValue = {high: 10, low: 9} as const;
      const replacedValue = {high: 6, low: 4} as const;

      const originalResult = swingLow.add(originalValue);
      const replacedResult = swingLow.replace(replacedValue);

      expect(originalResult).toBe(5);
      expect(replacedResult).toBeNull();

      const restoredResult = swingLow.replace(originalValue);

      expect(restoredResult).toBe(5);
    });
  });

  describe('getRequiredInputs', () => {
    it('returns the amount of required data needed for a calculation', () => {
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});
      expect(swingLow.getRequiredInputs()).toBe(5);
    });

    it('scales with the configured lookback', () => {
      const swingLow = new SwingLow({lookback: SwingLookback.CHARTISTS});
      expect(swingLow.getRequiredInputs()).toBe(11);
    });
  });
});
