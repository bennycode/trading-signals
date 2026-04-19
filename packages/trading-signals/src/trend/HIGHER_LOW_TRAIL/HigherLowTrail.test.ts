import {NotEnoughDataError} from '../../error/NotEnoughDataError.js';
import {HigherLowTrail} from './HigherLowTrail.js';

describe('HigherLowTrail', () => {
  describe('add', () => {
    it('emits a pullback low after one bar of higher-low confirmation', () => {
      const lows = [10, 8, 12] as const;
      const highs = lows.map(low => low + 2);
      const trail = new HigherLowTrail({lookback: 1});
      const detected: number[] = [];

      lows.forEach((low, i) => {
        const result = trail.add({high: highs[i], low});

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([8]);
      expect(trail.getResultOrThrow()).toBe(8);
    });

    it('raises the trail through progressively higher pullback lows', () => {
      const lows = [10, 8, 12, 9, 11, 7, 15, 13, 20] as const;
      const highs = lows.map(low => low + 2);
      const trail = new HigherLowTrail({lookback: 1});
      const detected: number[] = [];

      lows.forEach((low, i) => {
        const result = trail.add({high: highs[i], low});

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([8, 9, 13]);
    });

    it('emits every pullback low when monotonic is disabled', () => {
      const lows = [10, 8, 12, 9, 11, 7, 15, 13, 20] as const;
      const highs = lows.map(low => low + 2);
      const trail = new HigherLowTrail({lookback: 1, monotonic: false});
      const detected: number[] = [];

      lows.forEach((low, i) => {
        const result = trail.add({high: highs[i], low});

        if (result !== null) {
          detected.push(result);
        }
      });

      expect(detected).toEqual([8, 9, 7, 13]);
    });

    it('requires two strictly-higher-low bars when lookback is 2', () => {
      const lows = [10, 5, 6, 7, 4, 8, 9] as const;
      const highs = lows.map(low => low + 2);
      const trail = new HigherLowTrail({lookback: 2});
      const detected: number[] = [];

      lows.forEach((low, i) => {
        const result = trail.add({high: highs[i], low});

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
