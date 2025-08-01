import {ZigZag} from './ZigZag.js';

describe('ZigZag', () => {
  it('works', () => {
    const zigzag = new ZigZag({
      deviation: 15,
    });

    const dates = [
      -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
    ] as const;
    const highs = [
      -8, -4, -1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 22, 33, 44, 55, 66, 77, 88, 88, 71, 61, 51, 41, 51, 61, 71, 81, 91, 11,
    ] as const;
    const lows = [
      -9, -5, -2, 8, 7, 6, 5, 4, 3, 2, 1, 0, 10, 20, 30, 40, 50, 60, 70, 80, 85, 70, 60, 50, 40, 50, 60, 70, 80, 90, 10,
    ] as const;

    const candles = dates.map((date, index) => {
      return {
        date,
        high: highs[index],
        low: lows[index],
      };
    });

    for (const candle of candles) {
      const result = zigzag.add(candle);
      if (result) {
        // Expected: [-9, 9, 0, 88, 40, 91];
        console.log(candle.date, result.toString());
      }
    }
  });
});
