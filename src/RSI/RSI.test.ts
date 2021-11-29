import {FasterRSI, RSI} from './RSI';
import {NotEnoughDataError} from '../error';

describe('RSI', () => {
  describe('getResult', () => {
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
      const rsi = new RSI(5);
      const fasterRSI = new FasterRSI(5);
      for (const price of prices) {
        rsi.update(price);
        fasterRSI.update(price);
        if (rsi.isStable && fasterRSI.isStable) {
          const expected = expectations.shift();
          expect(rsi.getResult().toFixed(3)).toBe(expected!);
          expect(fasterRSI.getResult().toFixed(3)).toBe(expected!);
        }
      }
      expect(rsi.isStable).toBeTrue();
      expect(fasterRSI.isStable).toBeTrue();

      expect(rsi.getResult().toFixed(2)).toBe('78.50');
      expect(fasterRSI.getResult().toFixed(2)).toBe('78.50');

      expect(rsi.lowest?.toFixed(2)).toBe('64.93');
      expect(fasterRSI.lowest?.toFixed(2)).toBe('64.93');

      expect(rsi.highest?.toFixed(2)).toBe('91.48');
      expect(fasterRSI.highest?.toFixed(2)).toBe('91.48');
    });

    it('throws an error when there is not enough input data', () => {
      const rsi = new RSI(2);
      rsi.update(0);
      expect(rsi.isStable).toBeFalse();
      try {
        rsi.getResult();
        fail('Expected error');
      } catch (error) {
        expect(rsi.isStable).toBeFalse();
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
