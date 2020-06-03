import {MathAnalysis} from './MathAnalysis';

describe('MathAnalysis', () => {
  describe('getAverage', () => {
    it('returns 0 if the array is empty', () => {
      const average = MathAnalysis.getAverage([]);
      expect(average.valueOf()).toBe('0');
    });
  });
});
