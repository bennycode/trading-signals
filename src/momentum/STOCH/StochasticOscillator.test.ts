import {StochasticOscillator} from './StochasticOscillator.js';
import {NotEnoughDataError} from '../../error/index.js';
import {MomentumSignal} from '../../types/index.js';
import candles from '../../fixtures/STOCH/candles.json' with {type: 'json'};

describe('StochasticOscillator', () => {
  describe('update', () => {
    it('calculates the StochasticOscillator', () => {
      // Test data verified with:
      // https://tulipindicators.org/stoch
      const stochKs = ['77.39', '83.13', '84.87', '88.36', '95.25', '96.74', '91.09'] as const;
      const stochDs = ['75.70', '78.01', '81.79', '85.45', '89.49', '93.45', '94.36'] as const;

      const stoch = new StochasticOscillator(5, 3, 3);
      const offset = stoch.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const stochResult = stoch.add(candle);
        if (stoch.isStable && stochResult) {
          const stochD = stochDs[i - offset];
          const stochK = stochKs[i - offset];
          expect(stochResult.stochD.toFixed(2)).toEqual(stochD);
          expect(stochResult.stochK.toFixed(2)).toEqual(stochK);
        }
      });

      expect(stoch.isStable).toBe(true);
      expect(stoch.getRequiredInputs()).toBe(9);
      expect(stoch.getResultOrThrow().stochK.toFixed(2)).toBe('91.09');
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const stoch = new StochasticOscillator(5, 3, 3);

      // Add enough data to make it stable
      for (let i = 0; i < 9; i++) {
        stoch.add({close: 50 + i, high: 100, low: 10});
      }

      const originalValue = {close: 80, high: 100, low: 10} as const;
      const replacedValue = {close: 30, high: 100, low: 10} as const;

      // Add a value
      const originalResult = stoch.add(originalValue);

      // Replace it with a different value
      const replacedResult = stoch.replace(replacedValue);

      // Results should be different since we replaced with a different value
      expect(replacedResult?.stochK).not.toBe(originalResult?.stochK);

      // Test restoration
      const restoredResult = stoch.replace(originalValue);

      expect(restoredResult?.stochK).toBe(originalResult?.stochK);
    });
  });

  describe('getResultOrThrow', () => {
    it('throws an error when there is not enough input data', () => {
      const stoch = new StochasticOscillator(5, 3, 3);

      stoch.add({close: 1, high: 1, low: 1});
      stoch.add({close: 1, high: 2, low: 1});
      stoch.add({close: 1, high: 3, low: 1});
      stoch.add({close: 1, high: 4, low: 1});
      stoch.add({close: 1, high: 5, low: 1}); // Emits 1st of 3 required values for %d period
      stoch.add({close: 1, high: 6, low: 1}); // Emits 2nd of 3 required values for %d period

      try {
        stoch.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('prevents division by zero errors when highest high and lowest low have the same value', () => {
      const stoch = new StochasticOscillator(5, 3, 3);
      stoch.updates(
        [
          {close: 100, high: 100, low: 100},
          {close: 100, high: 100, low: 100},
          {close: 100, high: 100, low: 100},
          {close: 100, high: 100, low: 100},
          {close: 100, high: 100, low: 100},
          {close: 100, high: 100, low: 100},
          {close: 100, high: 100, low: 100},
          {close: 100, high: 100, low: 100},
        ],
        false
      );
      const result = stoch.add({close: 100, high: 100, low: 100});
      expect(result?.stochK.toFixed(2)).toBe('0.00');
      expect(result?.stochD.toFixed(2)).toBe('0.00');
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const stoch = new StochasticOscillator(5, 3, 3);
      const signal = stoch.getSignal();
      expect(signal.state).toBe(MomentumSignal.UNKNOWN);
    });

    it('returns OVERSOLD when stochK <= 20', () => {
      const stoch = new StochasticOscillator(5, 3, 3);
      // Build data that creates oversold condition
      for (let i = 0; i < 9; i++) {
        stoch.add({close: 20, high: 100, low: 10});
      }
      const signal = stoch.getSignal();
      expect(signal.state).toBe(MomentumSignal.OVERSOLD);
      expect(stoch.getResultOrThrow().stochK).toBeLessThanOrEqual(20);
    });

    it('returns OVERBOUGHT when stochK >= 80', () => {
      const stoch = new StochasticOscillator(5, 3, 3);
      // Build data that creates overbought condition
      for (let i = 0; i < 9; i++) {
        stoch.add({close: 95, high: 100, low: 10});
      }
      const signal = stoch.getSignal();
      expect(signal.state).toBe(MomentumSignal.OVERBOUGHT);
      expect(stoch.getResultOrThrow().stochK).toBeGreaterThanOrEqual(80);
    });

    it('returns NEUTRAL when stochK is between 20 and 80', () => {
      const stoch = new StochasticOscillator(5, 3, 3);
      // Build data that creates neutral condition
      for (let i = 0; i < 9; i++) {
        stoch.add({close: 50, high: 100, low: 10});
      }
      const signal = stoch.getSignal();
      expect(signal.state).toBe(MomentumSignal.NEUTRAL);
      const result = stoch.getResultOrThrow();
      expect(result.stochK).toBeGreaterThan(20);
      expect(result.stochK).toBeLessThan(80);
    });
  });
});
