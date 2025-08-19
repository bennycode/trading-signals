import {CCI} from './CCI.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('CCI', () => {
  // Test data verified with:
  // https://tulipindicators.org/cci
  // @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L99-L102
  const candles = [
    {close: 81.59, high: 82.15, low: 81.29},
    {close: 81.06, high: 81.89, low: 80.64},
    {close: 82.87, high: 83.03, low: 81.31},
    {close: 83.0, high: 83.3, low: 82.65},
    {close: 83.61, high: 83.85, low: 83.07},
    {close: 83.15, high: 83.9, low: 83.11},
    {close: 82.84, high: 83.33, low: 82.49},
    {close: 83.99, high: 84.3, low: 82.3},
    {close: 84.55, high: 84.84, low: 84.15},
    {close: 84.36, high: 85.0, low: 84.11},
    {close: 85.53, high: 85.9, low: 84.03},
    {close: 86.54, high: 86.58, low: 85.39},
    {close: 86.89, high: 86.98, low: 85.76},
    {close: 87.77, high: 88.0, low: 87.17},
    {close: 87.29, high: 87.87, low: 87.01},
  ] as const;
  const expectations = [
    '105.01',
    '64.24',
    '-29.63',
    '69.54',
    // @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L103
    '166.67',
    '82.02',
    '95.50',
    '130.91',
    '99.16',
    '116.34',
    '71.93',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;
      const cci = new CCI(interval);
      const cciWithReplace = new CCI(interval);

      const correct = {close: 87.0, high: 89.89, low: 87.0};
      const wrong = {close: 3_333, high: 5_555, low: 1_111};

      cci.updates(candles, false);
      cciWithReplace.updates(candles, false);

      cci.add(correct);
      cciWithReplace.add(wrong);
      expect(cci.getResultOrThrow().toFixed()).not.toBe(cciWithReplace.getResultOrThrow().toFixed());

      cciWithReplace.replace(correct);
      expect(cci.getResultOrThrow().toFixed()).toBe(cciWithReplace.getResultOrThrow().toFixed());
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Commodity Channel Index (CCI)', () => {
      const interval = 5;
      const cci = new CCI(interval);
      const offset = cci.getRequiredInputs() - 1;
      expect(cci.getRequiredInputs()).toBe(interval);

      candles.forEach((candle, i) => {
        cci.add(candle);

        if (cci.isStable) {
          const expected = expectations[i - offset];
          expect(cci.getResultOrThrow().toFixed(2)).toBe(expected);
        }
      });

      const actual = cci.getResultOrThrow().toFixed(2);
      expect(actual).toBe('71.93');
    });

    it('throws an error when there is not enough input data', () => {
      const cci = new CCI(5);
      try {
        cci.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
