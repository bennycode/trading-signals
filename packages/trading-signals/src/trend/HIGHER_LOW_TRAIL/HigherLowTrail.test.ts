import {NotEnoughDataError} from '../../error/NotEnoughDataError.js';
import {HigherLowTrail} from './HigherLowTrail.js';

describe('HigherLowTrail', () => {
  describe('add', () => {
    it('emits a pullback low after one bar of higher-low confirmation', () => {
      const candles = [
        {high: 12, low: 10},
        {high: 10, low: 8},
        {high: 14, low: 12},
      ] as const;
      const trail = new HigherLowTrail({lookback: 1});
      const detected: number[] = [];

      candles.forEach(candle => {
        const result = trail.add(candle);

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([8]);
      expect(trail.getResultOrThrow()).toBe(8);
    });

    it('raises the trail through progressively higher pullback lows', () => {
      const candles = [
        {high: 12, low: 10},
        {high: 10, low: 8},
        {high: 14, low: 12},
        {high: 11, low: 9},
        {high: 13, low: 11},
        {high: 9, low: 7},
        {high: 17, low: 15},
        {high: 15, low: 13},
        {high: 22, low: 20},
      ] as const;
      const trail = new HigherLowTrail({lookback: 1});
      const detected: number[] = [];

      candles.forEach(candle => {
        const result = trail.add(candle);

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([8, 9, 13]);
    });

    it('emits every pullback low when monotonic is disabled', () => {
      const candles = [
        {high: 12, low: 10},
        {high: 10, low: 8},
        {high: 14, low: 12},
        {high: 11, low: 9},
        {high: 13, low: 11},
        {high: 9, low: 7},
        {high: 17, low: 15},
        {high: 15, low: 13},
        {high: 22, low: 20},
      ] as const;
      const trail = new HigherLowTrail({lookback: 1, monotonic: false});
      const detected: number[] = [];

      candles.forEach(candle => {
        const result = trail.add(candle);

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([8, 9, 7, 13]);
    });

    it('requires two strictly-higher-low bars when lookback is 2', () => {
      const candles = [
        {high: 12, low: 10},
        {high: 7, low: 5},
        {high: 8, low: 6},
        {high: 9, low: 7},
        {high: 6, low: 4},
        {high: 10, low: 8},
        {high: 11, low: 9},
      ] as const;
      const trail = new HigherLowTrail({lookback: 2});
      const detected: number[] = [];

      candles.forEach(candle => {
        const result = trail.add(candle);

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([5]);
    });

    it('throws when accessed before enough data has been added', () => {
      const trail = new HigherLowTrail({lookback: 1});

      trail.add({high: 12, low: 10});

      expect(() => trail.getResultOrThrow()).toThrow(NotEnoughDataError);
      expect(trail.isStable).toBe(false);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const trail = new HigherLowTrail({lookback: 1});

      trail.add({high: 12, low: 10});
      trail.add({high: 10, low: 8});

      const originalValue = {high: 14, low: 12} as const;
      const replacedValue = {high: 9, low: 7} as const;

      const originalResult = trail.add(originalValue);
      const replacedResult = trail.replace(replacedValue);

      expect(originalResult).toBe(8);
      expect(replacedResult).toBeNull();

      const restoredResult = trail.replace(originalValue);

      expect(restoredResult).toBe(8);
    });
  });

  describe('getRequiredInputs', () => {
    it('returns the amount of required data needed for a calculation', () => {
      const trail = new HigherLowTrail({lookback: 1});
      expect(trail.getRequiredInputs()).toBe(2);
    });

    it('scales with the configured lookback', () => {
      const trail = new HigherLowTrail({lookback: 3});
      expect(trail.getRequiredInputs()).toBe(4);
    });
  });
});
