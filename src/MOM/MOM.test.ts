import {MOM} from './MOM.js';
import {NotEnoughDataError} from '../error/index.js';

describe('MOM', () => {
  describe('update', () => {
    it('can replace recently added values', () => {
      const fasterMomentum = new MOM(5);

      fasterMomentum.add(81.59);
      fasterMomentum.add(81.06);
      fasterMomentum.add(82.87);
      fasterMomentum.add(83.0);
      fasterMomentum.add(83.61);
      fasterMomentum.add(90);
      fasterMomentum.update(83.15, true);

      expect(fasterMomentum.isStable).toBe(true);
      expect(fasterMomentum.getResultOrThrow().toFixed(2)).toBe('1.56');
    });
  });

  describe('getResultOrThrow', () => {
    it('returns the price 5 intervals ago', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L286-L288
      const inputs = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const outputs = [1.56, 1.78, 1.12, 1.55, 0.75, 2.38, 3.7, 2.9, 3.22, 2.93] as const;
      const interval = 5;
      const fasterMomentum = new MOM(interval);

      for (const [index, input] of inputs.entries()) {
        fasterMomentum.add(input);
        if (fasterMomentum.isStable) {
          const expected = outputs[index - interval];
          expect(fasterMomentum.getResultOrThrow().toFixed(2)).toBe(expected.toFixed(2));
        }
      }

      expect(fasterMomentum.isStable).toBe(true);
      expect(fasterMomentum.getRequiredInputs()).toBe(6);
      expect(fasterMomentum.lowest?.toFixed(2)).toBe('0.75');
      expect(fasterMomentum.highest?.toFixed(2)).toBe('3.70');
    });

    it('throws an error when there is not enough input data', () => {
      const momentum = new MOM(5);

      try {
        momentum.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
