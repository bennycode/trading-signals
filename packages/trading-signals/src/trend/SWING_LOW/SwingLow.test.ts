import {NotEnoughDataError} from '../../error/NotEnoughDataError.js';
import {SwingLookback} from './SwingLookback.js';
import {SwingLow} from './SwingLow.js';

describe('SwingLow', () => {
  describe('add', () => {
    it('confirms a swing low once lookback candles on each side show higher lows', () => {
      const candles = [
        {high: 11, low: 10},
        {high: 9, low: 8},
        {high: 6, low: 5},
        {high: 8, low: 7},
        {high: 10, low: 9},
      ] as const;
      const expectations = [null, null, null, null, 5] as const;
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});

      candles.forEach((candle, i) => {
        const result = swingLow.add(candle);
        expect(result).toBe(expectations[i]);
      });

      expect(swingLow.isStable).toBe(true);
      expect(swingLow.getResultOrThrow()).toBe(5);
    });

    it('detects multiple swing lows across a longer series', () => {
      const candles = [
        {high: 12, low: 10},
        {high: 10, low: 8},
        {high: 7, low: 5},
        {high: 9, low: 7},
        {high: 11, low: 9},
        {high: 13, low: 11},
        {high: 8, low: 6},
        {high: 6, low: 4},
        {high: 9, low: 7},
        {high: 10, low: 8},
      ] as const;
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});
      const detected: number[] = [];

      candles.forEach(candle => {
        const result = swingLow.add(candle);

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([5, 4]);
    });

    it('ignores candidates when neighbors have an equal low (strict comparison)', () => {
      const candles = [
        {high: 11, low: 10},
        {high: 9, low: 8},
        {high: 6, low: 5},
        {high: 6, low: 5},
        {high: 10, low: 9},
      ] as const;
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});

      candles.forEach(candle => {
        swingLow.add(candle);
      });

      expect(swingLow.getResult()).toBeNull();
    });

    it('works with the chartist lookback of 5 candles per side', () => {
      const candles = [
        {high: 22, low: 20},
        {high: 21, low: 19},
        {high: 20, low: 18},
        {high: 19, low: 17},
        {high: 18, low: 16},
        {high: 12, low: 10},
        {high: 19, low: 17},
        {high: 20, low: 18},
        {high: 21, low: 19},
        {high: 22, low: 20},
        {high: 23, low: 21},
      ] as const;
      const swingLow = new SwingLow({lookback: SwingLookback.CHARTISTS});
      const detected: number[] = [];

      candles.forEach(candle => {
        const result = swingLow.add(candle);

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
    it('rolls back the stored pivot when a replacement invalidates the last emission', () => {
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});

      swingLow.add({high: 11, low: 10});
      swingLow.add({high: 9, low: 8});
      swingLow.add({high: 6, low: 5});
      swingLow.add({high: 8, low: 7});

      const originalValue = {high: 10, low: 9} as const;
      const replacedValue = {high: 6, low: 4} as const;

      const originalResult = swingLow.add(originalValue);

      expect(originalResult).toBe(5);
      expect(swingLow.getResult()).toBe(5);
      expect(swingLow.isStable).toBe(true);

      const replacedResult = swingLow.replace(replacedValue);

      expect(replacedResult).toBeNull();
      expect(swingLow.getResult()).toBeNull();
      expect(swingLow.isStable).toBe(false);

      const restoredResult = swingLow.replace(originalValue);

      expect(restoredResult).toBe(5);
      expect(swingLow.getResult()).toBe(5);
      expect(swingLow.isStable).toBe(true);
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
