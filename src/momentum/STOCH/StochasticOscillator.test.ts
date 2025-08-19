import {StochasticOscillator} from './StochasticOscillator.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('StochasticOscillator', () => {
  describe('update', () => {
    it('calculates the StochasticOscillator', () => {
      // Test data verified with:
      // https://tulipindicators.org/stoch
      const candles = [
        {close: 81.59, high: 82.15, low: 81.29},
        {close: 81.06, high: 81.89, low: 80.64},
        {close: 82.87, high: 83.03, low: 81.31},
        {close: 83.0, high: 83.3, low: 82.65},
        {close: 83.61, high: 83.85, low: 83.07},
        {close: 83.15, high: 83.9, low: 83.11},
        {close: 82.84, high: 83.33, low: 82.49},
        {close: 83.99, high: 84.3, low: 82.3},
        {close: 84.55, high: 84.84, low: 84.15},
        {close: 84.36, high: 85.0, low: 84.11},
        {close: 85.53, high: 85.9, low: 84.03},
        {close: 86.54, high: 86.58, low: 85.39},
        {close: 86.89, high: 86.98, low: 85.76},
        {close: 87.77, high: 88.0, low: 87.17},
        {close: 87.29, high: 87.87, low: 87.01},
      ] as const;

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
});
