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

      const expectations: [string, string][] = [
        ['77.39', '75.70'],
        ['83.13', '78.01'],
        ['84.87', '81.79'],
        ['88.36', '85.45'],
        ['95.25', '89.49'],
        ['96.74', '93.45'],
        ['91.09', '94.36'],
      ];

      const stoch = new StochasticOscillator(5, 3, 3);
      for (let i = 0; i < candles.length; i++) {
        const [high, low, close] = candles[i];
        stoch.update({high, low, close});
        if (stoch.isStable) {
          const [stoch_k, stoch_d] = expectations[i];
          const result = stoch.getResult();
          expect(result.k.valueOf()).withContext('%k').toBe(stoch_k);
          expect(result.d.valueOf()).withContext('%d').toBe(stoch_d);
        }
      }
    });
  });
});
