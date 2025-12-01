import {getQuartile} from './getQuartile.js';

describe('getQuartile', () => {
  describe('even number of elements', () => {
    it('calculates the first quartile (Q1)', () => {
      const prices = [1, 3, 5, 7, 9, 11];

      const result = getQuartile(prices, 0.25);

      // For even number of elements: [1, 3, 5, 7, 9, 11]
      // Median index is 3, lower half is [1, 3, 5]
      // Q1 is median of lower half: 3 -> (1 + 3 + 5) / 3
      expect(result).toBe(3);
    });

    it('calculates the third quartile (Q3)', () => {
      const prices = [1, 3, 5, 7, 9, 11];

      const result = getQuartile(prices, 0.75);

      // For even number of elements: [1, 3, 5, 7, 9, 11]
      // Median index is 3, upper half is [7, 9, 11]
      // Q3 is median of upper half: 9 -> (7 + 9 + 11) / 3
      expect(result).toBe(9);
    });
  });

  describe('odd number of elements', () => {
    it('calculates the first quartile (Q1)', () => {
      const prices = [1, 3, 5, 7, 9];

      const result = getQuartile(prices, 0.25);

      // For odd number of elements: [1, 3, 5, 7, 9]
      // Median index is 2, lower half is [1, 3]
      // Q1 is median of lower half: 2 -> (1 + 3) / 2
      expect(result).toBe(2);
    });

    it('calculates the second quartile (Q2)', () => {
      // Test data verified with:
      // https://en.wikipedia.org/wiki/Quartile#Example_2
      const prices = [7, 15, 36, 39, 40, 41];

      const result = getQuartile(prices, 0.5);

      expect(result).toBe(37.5);
    });

    it('calculates the third quartile (Q3)', () => {
      const prices = [1, 3, 5, 7, 9];

      const result = getQuartile(prices, 0.75);

      // For odd number of elements: [1, 3, 5, 7, 9]
      // Median index is 2, upper half is [7, 9]
      // Q3 is median of upper half: 8 -> (7 + 9) / 2
      expect(result).toBe(8);
    });
  });

  it('calculates quartiles for decimal values', () => {
    const prices = [1.1, 2.2, 3.3, 4.4];

    const q1 = getQuartile(prices, 0.25);
    const q3 = getQuartile(prices, 0.75);

    // Type "number" has floating point issues!
    expect(q1).toBe(1.6500000000000001);
    expect(q3).toBe(3.85);
  });

  it('throws error for empty arrays', () => {
    expect(() => {
      getQuartile([], 0.25);
    }).toThrow('Cannot calculate median of empty array');
  });
});
