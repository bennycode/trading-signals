import {MOM} from './MOM';
import {NotEnoughDataError} from '../error';

describe('MOM', () => {
  describe('getResult', () => {
    it('returns the price 5 intervals ago', () => {
      // Test data taken from:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L286-L288
      const inputs = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];
      const outputs = [1.56, 1.78, 1.12, 1.55, 0.75, 2.38, 3.7, 2.9, 3.22, 2.93];
      const momentum = new MOM(5);

      for (const input of inputs) {
        momentum.update(input);
        if (momentum.isStable) {
          const actual = momentum.getResult().toFixed(3);
          const expected = outputs.shift();
          expect(parseFloat(actual)).toBe(expected!);
        }
      }

      expect(momentum.lowest!.toFixed(2)).toBe('0.75');
      expect(momentum.highest!.toFixed(2)).toBe('3.70');
    });

    it('throws an error when there is not enough input data', () => {
      const momentum = new MOM(5);

      try {
        momentum.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
