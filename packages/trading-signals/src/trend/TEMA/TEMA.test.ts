import {TEMA} from './TEMA.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('TEMA', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L400-L402
   */
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = ['87.042', '87.819', '87.721'] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const tema = new TEMA(5);

      tema.updates(prices, false);

      const originalValue = 90;
      const replacedValue = 83;

      const originalResult = tema.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('89.49');

      const replacedResult = tema.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('84.57');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = tema.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const tema = new TEMA(interval);
      const offset = tema.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = tema.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(tema.isStable).toBe(true);
      expect(tema.getRequiredInputs()).toBe(13);
    });

    it('throws an error when there is not enough input data', () => {
      const tema = new TEMA(5);

      try {
        tema.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
