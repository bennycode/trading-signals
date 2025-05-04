import Big from 'big.js';
import {getQuartile, getFasterQuartile} from './getQuartile.js';

describe('getQuartile', () => {
  describe('even number of elements', () => {
    it('calculates the first quartile (Q1)', () => {
      const values = [new Big(1), new Big(3), new Big(5), new Big(7), new Big(9), new Big(11)];

      const result = getQuartile(values, 0.25);

      // For even number of elements: [1, 3, 5, 7, 9, 11]
      // Median index is 3, lower half is [1, 3, 5]
      // Q1 is median of lower half: 3 -> (1 + 3 + 5) / 3
      expect(result.valueOf()).toBe('3');
    });

    it('calculates the third quartile (Q3)', () => {
      const values = [new Big(1), new Big(3), new Big(5), new Big(7), new Big(9), new Big(11)];

      const result = getQuartile(values, 0.75);

      // For even number of elements: [1, 3, 5, 7, 9, 11]
      // Median index is 3, upper half is [7, 9, 11]
      // Q3 is median of upper half: 9 -> (7 + 9 + 11) / 3
      expect(result.valueOf()).toBe('9');
    });
  });

  describe('odd number of elements', () => {
    it('calculates the first quartile (Q1)', () => {
      const values = [new Big(1), new Big(3), new Big(5), new Big(7), new Big(9)];

      const result = getQuartile(values, 0.25);

      // For odd number of elements: [1, 3, 5, 7, 9]
      // Median index is 2, lower half is [1, 3]
      // Q1 is median of lower half: 2 -> (1 + 3) / 2
      expect(result.valueOf()).toBe('2');
    });

    it('calculates the third quartile (Q3)', () => {
      const values = [new Big(1), new Big(3), new Big(5), new Big(7), new Big(9)];

      const result = getQuartile(values, 0.75);

      // For odd number of elements: [1, 3, 5, 7, 9]
      // Median index is 2, upper half is [7, 9]
      // Q3 is median of upper half: 8 -> (7 + 9) / 2
      expect(result.valueOf()).toBe('8');
    });
  });

  it('calculates quartiles for decimal values', () => {
    const values = [new Big('1.1'), new Big('2.2'), new Big('3.3'), new Big('4.4')];

    const q1 = getQuartile(values, 0.25);
    const q3 = getQuartile(values, 0.75);

    expect(q1.valueOf()).toBe('1.65');
    expect(q3.valueOf()).toBe('3.85');
  });

  it('throws error for empty arrays', () => {
    expect(() => {
      getQuartile([], 0.25);
    }).toThrow('Cannot calculate median of empty array');
  });
});

describe('getFasterQuartile', () => {
  describe('even number of elements', () => {
    it('calculates the first quartile (Q1)', () => {
      const values = [1, 3, 5, 7, 9, 11];

      const result = getFasterQuartile(values, 0.25);

      // For even number of elements: [1, 3, 5, 7, 9, 11]
      // Median index is 3, lower half is [1, 3, 5]
      // Q1 is median of lower half: 3 -> (1 + 3 + 5) / 3
      expect(result).toBe(3);
    });

    it('calculates the third quartile (Q3)', () => {
      const values = [1, 3, 5, 7, 9, 11];

      const result = getFasterQuartile(values, 0.75);

      // For even number of elements: [1, 3, 5, 7, 9, 11]
      // Median index is 3, upper half is [7, 9, 11]
      // Q3 is median of upper half: 9 -> (7 + 9 + 11) / 3
      expect(result).toBe(9);
    });
  });

  describe('odd number of elements', () => {
    it('calculates the first quartile (Q1)', () => {
      const values = [1, 3, 5, 7, 9];

      const result = getFasterQuartile(values, 0.25);

      // For odd number of elements: [1, 3, 5, 7, 9]
      // Median index is 2, lower half is [1, 3]
      // Q1 is median of lower half: 2 -> (1 + 3) / 2
      expect(result).toBe(2);
    });

    it('calculates the third quartile (Q3)', () => {
      const values = [1, 3, 5, 7, 9];

      const result = getFasterQuartile(values, 0.75);

      // For odd number of elements: [1, 3, 5, 7, 9]
      // Median index is 2, upper half is [7, 9]
      // Q3 is median of upper half: 8 -> (7 + 9) / 2
      expect(result).toBe(8);
    });
  });

  it('calculates quartiles for decimal values', () => {
    const values = [1.1, 2.2, 3.3, 4.4];

    const q1 = getFasterQuartile(values, 0.25);
    const q3 = getFasterQuartile(values, 0.75);

    // Type "number" has floating point issues!
    expect(q1).toBe(1.6500000000000001);
    expect(q3).toBe(3.85);
  });

  it('throws error for empty arrays', () => {
    expect(() => {
      getFasterQuartile([], 0.25);
    }).toThrow('Cannot calculate median of empty array');
  });
});
