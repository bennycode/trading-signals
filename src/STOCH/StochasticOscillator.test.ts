import {StochasticOscillator} from './StochasticOscillator';
import {NotEnoughDataError} from '../error';

describe('StochasticOscillator', () => {
  describe('update', () => {
    it('is stable when the amount of inputs is bigger than the required interval', () => {
      // Test data verified with:
      // https://runkit.com/anandaravindan/stochastic
      const highs = [
        127.009, 127.616, 126.591, 127.347, 128.173, 128.432, 127.367, 126.422, 126.9, 126.85, 125.646, 125.716,
        127.158, 127.715, 127.686, 128.223, 128.273, 128.093, 128.273, 127.735, 128.77, 129.287, 130.063, 129.118,
        129.287, 128.472, 128.093, 128.651, 129.138, 128.641,
      ];
      const lows = [
        125.357, 126.163, 124.93, 126.094, 126.82, 126.482, 126.034, 124.83, 126.392, 125.716, 124.562, 124.572,
        125.069, 126.86, 126.631, 126.8, 126.711, 126.8, 126.134, 125.925, 126.989, 127.815, 128.472, 128.064, 127.606,
        127.596, 126.999, 126.9, 127.487, 127.397,
      ];
      const closes = [
        125.357, 126.163, 124.93, 126.094, 126.82, 126.482, 126.034, 124.83, 126.392, 125.716, 124.562, 124.572,
        125.069, 127.288, 127.178, 128.014, 127.109, 127.725, 127.059, 127.327, 128.71, 127.875, 128.581, 128.601,
        127.934, 128.113, 127.596, 127.596, 128.69, 128.273,
      ];

      const expectations = [
        {d: '75.75', k: '89.20'},
        {d: '74.20', k: '65.81'},
        {d: '78.91', k: '81.73'},
        {d: '70.69', k: '64.52'},
        {d: '73.59', k: '74.51'},
        {d: '79.20', k: '98.57'},
        {d: '81.07', k: '70.12'},
        {d: '80.58', k: '73.06'},
        {d: '72.20', k: '73.42'},
        {d: '69.24', k: '61.23'},
        {d: '65.20', k: '60.95'},
        {d: '54.19', k: '40.38'},
        {d: '47.24', k: '40.38'},
        {d: '49.19', k: '66.82'},
        {d: '54.65', k: '56.74'},
      ];

      const stoch = new StochasticOscillator(14, 3);

      for (let i = 0; i < highs.length; i++) {
        stoch.update({
          close: closes[i],
          high: highs[i],
          low: lows[i],
        });
        if (stoch.isStable) {
          const {k, d} = stoch.getResult();
          const expected = expectations.shift()!;
          expect(k.toFixed(2)).toBe(expected.k);
          expect(d.toFixed(2)).toBe(expected.d);
        }
      }

      const {k, d} = stoch.getResult();
      expect(k.toFixed(2)).toBe('56.74');
      expect(d.toFixed(2)).toBe('54.65');
    });
  });

  describe('getResult', () => {
    it('throws an error when there is not enough input data', () => {
      const stoch = new StochasticOscillator(5, 3);

      try {
        stoch.update({close: 1, high: 1, low: 1});
        stoch.update({close: 1, high: 2, low: 1});
        stoch.update({close: 1, high: 3, low: 1});
        stoch.update({close: 1, high: 4, low: 1});
        stoch.update({close: 1, high: 5, low: 1}); // Emits 1st of 3 required values for %d period
        stoch.update({close: 1, high: 6, low: 1}); // Emits 2nd of 3 required values for %d period
        stoch.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('prevents division by zero errors when highest high and lowest low have the same value', () => {
      const stoch = new StochasticOscillator(5, 3);
      stoch.update({close: 100, high: 100, low: 100});
      stoch.update({close: 100, high: 100, low: 100});
      stoch.update({close: 100, high: 100, low: 100});
      stoch.update({close: 100, high: 100, low: 100});
      stoch.update({close: 100, high: 100, low: 100});
      stoch.update({close: 100, high: 100, low: 100});
      const result = stoch.update({close: 100, high: 100, low: 100})!;
      expect(result.k.toFixed(2)).toBe('0.00');
      expect(result.d.toFixed(2)).toBe('0.00');
    });
  });
});
