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
    it('rolls back the stored trail when a replacement invalidates the last emission', () => {
      const trail = new HigherLowTrail({lookback: 1});

      trail.add({high: 12, low: 10});
      trail.add({high: 10, low: 8});

      const originalValue = {high: 14, low: 12} as const;
      const replacedValue = {high: 9, low: 7} as const;

      const originalResult = trail.add(originalValue);

      expect(originalResult).toBe(8);
      expect(trail.getResult()).toBe(8);
      expect(trail.isStable).toBe(true);

      const replacedResult = trail.replace(replacedValue);

      expect(replacedResult).toBeNull();
      expect(trail.getResult()).toBeNull();
      expect(trail.isStable).toBe(false);

      const restoredResult = trail.replace(originalValue);

      expect(restoredResult).toBe(8);
      expect(trail.getResult()).toBe(8);
      expect(trail.isStable).toBe(true);
    });

    it('preserves the monotonic trail when replacing a non-emitting bar that would otherwise form a lower pivot', () => {
      // Regression test: earlier implementations compared against `previousResult` on replace,
      // which was `undefined` after a non-emitting bar, so the monotonic guard silently let
      // the trail collapse downward on the replacement.
      const trail = new HigherLowTrail({lookback: 2});

      const setup = [
        {high: 22, low: 20},
        {high: 27, low: 25},
        {high: 32, low: 30}, // emits trail = 20
        {high: 7, low: 5}, // window slides; no pivot confirmed
        {high: 12, low: 10}, // still no pivot confirmed
        {high: 17, low: 15}, // would emit pivot 5 but monotonic guard blocks it
      ] as const;

      setup.forEach(candle => trail.add(candle));

      expect(trail.getResult()).toBe(20);

      // Replace the last (non-emitting) bar. The replacement also forms a pivot 5, which
      // must stay blocked by the monotonic guard because the current trail is 20.
      const replaced = trail.replace({high: 22, low: 20});

      expect(replaced).toBeNull();
      expect(trail.getResult()).toBe(20);
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
