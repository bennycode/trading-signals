import {getStreaks} from './getStreaks.js';

describe('getStreaks', () => {
  const input = [10, 20, 30, 40, 32, 42, 50, 45, 44, 41, 59, 90, 100];

  describe('uptrends', () => {
    it('keeps track of upward streak lengths', () => {
      const actual = getStreaks(input, 'up');
      expect(actual.map(s => s.length)).toStrictEqual([3, 2, 3]);
    });

    it('keeps track of price increases during an upward streak', () => {
      const actual = getStreaks(input, 'up');
      expect(actual.map(s => s.percentage)).toStrictEqual([300, 56.25, 143.90243902439025]);
    });
  });

  describe('downtrends', () => {
    it('keeps track of downward streak lengths', () => {
      const actual = getStreaks(input, 'down');
      expect(actual.map(s => s.length)).toStrictEqual([1, 3]);
    });

    it('keeps track of price decreases during a downward streak', () => {
      const actual = getStreaks(input, 'down');
      expect(actual.map(s => s.percentage)).toStrictEqual([-20, -18]);
    });
  });

  describe('special cases', () => {
    it("doesn't record a streak of 1", () => {
      const actual = getStreaks([1], 'up');
      expect(actual.map(s => s.length)).toStrictEqual([]);
    });
  });
});
