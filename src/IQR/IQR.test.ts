import {IQR, FasterIQR} from './IQR.js';
import Big from 'big.js';

describe('IQR', () => {
  it('returns null until enough values are provided (Big.js)', () => {
    const iqr = new IQR(5);

    for (let i = 0; i < 4; i++) {
      const result = iqr.update(new Big(i), false);
      expect(result).toBeNull();
    }
  });

  it('calculates the interquartile range for a window (Big.js)', () => {
    const iqr = new IQR(5);
    const values = [1, 2, 3, 4, 100];

    for (const v of values) {
      iqr.update(new Big(v), false);
    }

    // Using Wikipedia method:
    // Sorted array: [1, 2, 3, 4, 100]
    // Median is 3
    // Lower half: [1, 2] → Q1 = 1.5
    // Upper half: [4, 100] → Q3 = 52
    // IQR = 52 - 1.5 = 50.5
    const result = iqr.update(new Big(100), true); // replace last value to keep window

    expect(result?.eq(50.5)).toBe(true);
  });

  it('updates IQR as new values enter and old values leave the window (Big.js)', () => {
    const iqr = new IQR(3);

    iqr.update(new Big(1), false);
    iqr.update(new Big(2), false);
    iqr.update(new Big(3), false);

    // Using Wikipedia method:
    // Window is [2, 3, 4]
    // Median is 3
    // Lower half: [2] → Q1 = 2
    // Upper half: [4] → Q3 = 4
    // IQR = 4 - 2 = 2
    const result = iqr.update(new Big(4), false);

    expect(result?.eq(2)).toBe(true);
  });

  it('correctly calculates IQR for [7,7,31,31,47,75,87,115,116,119,119,155,177] (Big.js)', () => {
    const iqr = new IQR(13);
    const values = [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177];

    for (const v of values.slice(0, -1)) {
      iqr.update(new Big(v), false);
    }

    // Using Wikipedia method:
    // Sorted: [7,7,31,31,47,75,87,115,116,119,119,155,177]
    // Median is 87
    // Lower half: [7,7,31,31,47,75] → Q1 = 31
    // Upper half: [115,116,119,119,155,177] → Q3 = 119
    // IQR = 119 - 31 = 88
    const result = iqr.update(new Big(values[values.length - 1]), false);

    expect(result?.eq(88)).toBe(true);
  });
});

describe('FasterIQR', () => {
  it('returns null until enough values are provided (number)', () => {
    const iqr = new FasterIQR(5);

    for (let i = 0; i < 4; i++) {
      const result = iqr.update(i, false);
      expect(result).toBeNull();
    }
  });

  it('calculates the interquartile range for a window (number)', () => {
    const iqr = new FasterIQR(5);
    const values = [1, 2, 3, 4, 100];

    for (const v of values) {
      iqr.update(v, false);
    }

    // Using Wikipedia method:
    // Sorted array: [1, 2, 3, 4, 100]
    // Median is 3
    // Lower half: [1, 2] → Q1 = 1.5
    // Upper half: [4, 100] → Q3 = 52
    // IQR = 52 - 1.5 = 50.5
    const result = iqr.update(100, true);

    expect(result).toBe(50.5);
  });

  it('updates IQR as new values enter and old values leave the window (number)', () => {
    const iqr = new FasterIQR(3);

    iqr.update(1, false);
    iqr.update(2, false);
    iqr.update(3, false);

    // Using Wikipedia method:
    // Window is [2, 3, 4]
    // Median is 3
    // Lower half: [2] → Q1 = 2
    // Upper half: [4] → Q3 = 4
    // IQR = 4 - 2 = 2
    const result = iqr.update(4, false);

    expect(result).toBe(2);
  });

  it('correctly calculates IQR for [7,7,31,31,47,75,87,115,116,119,119,155,177] (number)', () => {
    const iqr = new FasterIQR(13);
    const values = [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177];

    for (const v of values.slice(0, -1)) {
      iqr.update(v, false);
    }

    // Using Wikipedia method:
    // Sorted: [7,7,31,31,47,75,87,115,116,119,119,155,177]
    // Median is 87
    // Lower half: [7,7,31,31,47,75] → Q1 = 31
    // Upper half: [115,116,119,119,155,177] → Q3 = 119
    // IQR = 119 - 31 = 88
    const result = iqr.update(values[values.length - 1], false);

    expect(result).toBe(88);
  });
});

describe('IQR with specific dataset', () => {
  it('calculates correct IQR=8 for [4,4,6,7,10,11,12,14,15] using Big.js', () => {
    const iqr = new IQR(9);
    const values = [4, 4, 6, 7, 10, 11, 12, 14, 15];

    for (const value of values.slice(0, -1)) {
      iqr.update(new Big(value), false);
    }

    const result = iqr.update(new Big(values[values.length - 1]), false);
    // Using Wikipedia method:
    // Sorted: [4, 4, 6, 7, 10, 11, 12, 14, 15]
    // Median is 10
    // Lower half: [4, 4, 6, 7] → Q1 = 5
    // Upper half: [11, 12, 14, 15] → Q3 = 13
    // IQR = 13 - 5 = 8

    expect(result?.eq(8)).toBe(true);
  });

  it('calculates correct IQR=8 for [4,4,6,7,10,11,12,14,15] using numbers', () => {
    const iqr = new FasterIQR(9);
    const values = [4, 4, 6, 7, 10, 11, 12, 14, 15];

    for (const value of values.slice(0, -1)) {
      iqr.update(value, false);
    }

    const result = iqr.update(values[values.length - 1], false);

    expect(result).toBe(8);
  });
});

describe('IQR with dataset [7, 9, 9, 10, 10, 10, 11, 12, 12, 14]', () => {
  it('calculates correct IQR=3 using Big.js', () => {
    const iqr = new IQR(10);
    const values = [7, 9, 9, 10, 10, 10, 11, 12, 12, 14];

    for (const value of values.slice(0, -1)) {
      iqr.update(new Big(value), false);
    }

    const result = iqr.update(new Big(values[values.length - 1]), false);
    // Using Wikipedia method:
    // Sorted: [7, 9, 9, 10, 10, 10, 11, 12, 12, 14]
    // Median is 10 (average of 5th and 6th elements)
    // Lower half: [7, 9, 9, 10, 10] → Q1 = 9 (median of lower half)
    // Upper half: [10, 11, 12, 12, 14] → Q3 = 12 (median of upper half)
    // IQR = 12 - 9 = 3

    expect(result?.eq(3)).toBe(true);
  });

  it('calculates correct IQR=3 using numbers', () => {
    const iqr = new FasterIQR(10);
    const values = [7, 9, 9, 10, 10, 10, 11, 12, 12, 14];

    for (const value of values.slice(0, -1)) {
      iqr.update(value, false);
    }

    const result = iqr.update(values[values.length - 1], false);

    expect(result).toBe(3);
  });
});
