import {RSI} from './RSI.js';
import {NotEnoughDataError} from '../error/index.js';

describe('RSI', () => {
  describe('update', () => {
    it('can replace recently added values', () => {
      const fasterRSI = new RSI(5);
      fasterRSI.add(81.59);
      fasterRSI.add(81.06);
      fasterRSI.add(82.87);
      fasterRSI.add(83.0);
      fasterRSI.add(83.61);
      fasterRSI.add(83.15);
      fasterRSI.add(82.84);
      fasterRSI.add(90); // this value gets replaced with the next call
      fasterRSI.update(83.99, true);

      expect(fasterRSI.isStable).toBe(true);
      expect(fasterRSI.getResultOrThrow().toFixed(2)).toBe('75.94');
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the relative strength index', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L347-L349
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];
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
      ];
      const interval = 5;
      const fasterRSI = new RSI(interval);
      for (const price of prices) {
        fasterRSI.add(price);
        if (fasterRSI.isStable) {
          const expected = expectations.shift();
          expect(fasterRSI.getResultOrThrow().toFixed(3)).toBe(expected);
        }
      }
      expect(fasterRSI.isStable).toBe(true);
      expect(fasterRSI.getRequiredInputs()).toBe(interval);
      expect(fasterRSI.getResultOrThrow().toFixed(2)).toBe('78.50');
      expect(fasterRSI.lowest?.toFixed(2)).toBe('64.93');
      expect(fasterRSI.highest?.toFixed(2)).toBe('91.48');
    });

    it('catches division by zero errors', () => {
      const updates = [2, 2, 2];
      const fasterRSI = new RSI(2);
      fasterRSI.updates(updates, false);
      expect(fasterRSI.getResultOrThrow()).toBe(100);
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
