import {StochasticOscillator} from './StochasticOscillator';

describe('StochasticOscillator', () => {
  describe('getResult', () => {
    // Test vectors taken from: https://tulipindicators.org/stoch
    it('is stable when the amount of inputs is bigger than the required interval', () => {
      const candles: [number, number, number][] = [
        [82.15, 81.29, 81.59],
        [81.89, 80.64, 81.06],
        [83.03, 81.31, 82.87],
        [83.3, 82.65, 83.0],
        [83.85, 83.07, 83.61],
        [83.9, 83.11, 83.15],
        [83.33, 82.49, 82.84],
        [84.3, 82.3, 83.99],
        [84.84, 84.15, 84.55],
        [85.0, 84.11, 84.36],
        [85.9, 84.03, 85.53],
        [86.58, 85.39, 86.54],
        [86.98, 85.76, 86.89],
        [88.0, 87.17, 87.77],
        [87.87, 87.01, 87.29],
      ];

      const so = new StochasticOscillator(5, 3, 3);
      for (const [high, low, close] of candles) {
        so.update(high, low, close);
      }
    });
  });
});
