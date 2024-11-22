import {getStreaks} from './getStreaks.js';

describe('getStreaks', () => {
  const input = [10, 20, 30, 40, 32, 42, 50, 45, 44, 41, 59, 90, 100];

  it('keeps an array of upward combinations', () => {
    const actual = getStreaks(input, 'up');
    expect(actual).toStrictEqual([3, 2, 3]);
  });

  it('keeps an array of upward combinations', () => {
    const actual = getStreaks(input, 'down');
    expect(actual).toStrictEqual([1, 3]);
  });
});
