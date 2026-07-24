import {Aroon} from './Aroon.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('Aroon', () => {
  /*
   * Test data verified with:
   * https://tulipindicators.org/aroon
   * @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L54-L58
   */
  const candles = [
    {high: 82.15, low: 81.29},
    {high: 81.89, low: 80.64},
    {high: 83.03, low: 81.31},
    {high: 83.3, low: 82.65},
    {high: 83.85, low: 83.07},
    {high: 83.9, low: 83.11},
    {high: 83.33, low: 82.49},
    {high: 84.3, low: 82.3},
    {high: 84.84, low: 84.15},
    {high: 85.0, low: 84.11},
    {high: 85.9, low: 84.03},
    {high: 86.58, low: 85.39},
    {high: 86.98, low: 85.76},
    {high: 88.0, low: 87.17},
    {high: 87.87, low: 87.01},
  ] as const;
  const expectedDowns = [
    '20.000',
    '0.000',
    '0.000',
    '80.000',
    '60.000',
    '40.000',
    '20.000',
    '0.000',
    '40.000',
    '20.000',
  ] as const;
  const expectedUps = [
    '100.000',
    '80.000',
    '100.000',
    '100.000',
    '100.000',
    '100.000',
    '100.000',
    '100.000',
    '100.000',
    '80.000',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;
      const aroon = new Aroon(interval);
      const aroonWithReplace = new Aroon(interval);

      const correct = {high: 90.0, low: 89.0} as const;
      const wrong = {high: 82.0, low: 79.0} as const;

      aroon.updates(candles, false);
      aroonWithReplace.updates(candles, false);

      const originalResult = aroon.add(correct);
      const replacedResult = aroonWithReplace.add(wrong);

      expect(replacedResult?.aroonDown).not.toBe(originalResult?.aroonDown);

      const restoredResult = aroonWithReplace.replace(correct);

      expect(restoredResult?.aroonDown).toBe(originalResult?.aroonDown);
      expect(restoredResult?.aroonUp).toBe(originalResult?.aroonUp);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const aroon = new Aroon(interval);
      const offset = aroon.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = aroon.add(candle);

        if (result) {
          expect(result.aroonDown.toFixed(3)).toBe(expectedDowns[i - offset]);
          expect(result.aroonUp.toFixed(3)).toBe(expectedUps[i - offset]);
        }
      });

      expect(aroon.isStable).toBe(true);
      expect(aroon.getRequiredInputs()).toBe(interval + 1);
    });

    it('throws an error when there is not enough input data', () => {
      const aroon = new Aroon(5);

      try {
        aroon.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
