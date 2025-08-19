import {RSI} from './RSI.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('RSI', () => {
  describe('update', () => {
    it('can replace recently added values', () => {
      const rsi = new RSI(5);

      rsi.add(81.59);
      rsi.add(81.06);
      rsi.add(82.87);
      rsi.add(83.0);
      rsi.add(83.61);
      rsi.add(83.15);
      rsi.add(82.84);
      rsi.add(90); // this value gets replaced with the next call
      rsi.replace(83.99);

      expect(rsi.isStable).toBe(true);
      expect(rsi.getResultOrThrow().toFixed(2)).toBe('75.94');
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the relative strength index', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L347-L349
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expectations = [
        '72.034',
        '64.927',
        '75.936',
        '79.796',
        '74.713',
        '83.033',
        '87.478',
        '88.755',
        '91.483',
        '78.498',
      ] as const;

      const interval = 5;
      const rsi = new RSI(interval);
      const offset = rsi.getRequiredInputs();

      prices.forEach((price, i) => {
        rsi.add(price);
        if (rsi.isStable) {
          const expected = expectations[i - offset];
          expect(rsi.getResultOrThrow().toFixed(3)).toBe(expected);
        }
      });

      expect(rsi.isStable).toBe(true);
      expect(rsi.getRequiredInputs()).toBe(interval);
      expect(rsi.getResultOrThrow().toFixed(2)).toBe('78.50');
    });

    it('catches division by zero errors', () => {
      const updates = [2, 2, 2];
      const rsi = new RSI(2);
      rsi.updates(updates, false);
      expect(rsi.getResultOrThrow()).toBe(100);
    });

    it('throws an error when there is not enough input data', () => {
      const rsi = new RSI(2);
      rsi.add(0);
      expect(rsi.isStable).toBe(false);
      try {
        rsi.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(rsi.isStable).toBe(false);
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
