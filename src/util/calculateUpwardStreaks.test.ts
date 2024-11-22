import {calculateUpwardStreaks} from './calculateUpwardStreaks.js';

describe('calculateUpwardStreaks', () => {
  it('keeps an array of upward combinations', () => {
    const input = [10, 20, 30, 40, 32, 42, 50, 45, 44, 41, 59, 90, 100];
    const actual = calculateUpwardStreaks(input);
    expect(actual).toStrictEqual([3, 2, 3]);
  });
});
