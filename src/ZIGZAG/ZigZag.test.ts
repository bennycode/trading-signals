import {ZigZag} from './ZigZag.js';

describe('ZigZag', () => {
  describe('add', () => {
    it('returns the extreme values when the deviation threshold is met', () => {
      // Test data verified with:
      // https://github.com/munrocket/ta-math/blob/abdba60394582fa5847f57e87969dcd2d22b6ce8/test/test.js#L306-L308
      const highs = [
        -8, -4, -1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 22, 33, 44, 55, 66, 77, 88, 88, 71, 61, 51, 41, 51, 61, 71, 81, 91,
        11,
      ] as const;

      const lows = [
        -9, -5, -2, 8, 7, 6, 5, 4, 3, 2, 1, 0, 10, 20, 30, 40, 50, 60, 70, 80, 85, 70, 60, 50, 40, 50, 60, 70, 80, 90,
        10,
      ] as const;

      const expected = [-9, 9, 0, 88, 40, 91] as const;

      const deviation = 15;

      const zigzag = new ZigZag({deviation});

      const candles = highs.map((high, index) => {
        return {
          high,
          low: lows[index],
        };
      });

      const results = [];

      for (const candle of candles) {
        const result = zigzag.add(candle);
        if (result !== null) {
          results.push(result);
        }
      }

      expect(results).toEqual(expected);
    });
  });

  describe('getRequiredInputs', () => {
    it('returns the amount of required data needed for a calculation', () => {
      const expected = 1;
      const zigzag = new ZigZag({deviation: 15});
      expect(zigzag.getRequiredInputs()).toBe(expected);
    });
  });
});
