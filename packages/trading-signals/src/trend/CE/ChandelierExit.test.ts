import {ChandelierExit} from './ChandelierExit.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('ChandelierExit', () => {
  /*
   * Expected values computed with an independent implementation of the StockCharts formula
   * (highest high − multiplier × ATR / lowest low + multiplier × ATR, Wilder's ATR):
   * https://school.stockcharts.com/doku.php?id=technical_indicators:chandelier_exit
   */
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
  const expectedLongs = [
    '80.502',
    '80.748',
    '80.874',
    '80.679',
    '81.433',
    '81.741',
    '82.171',
    '82.882',
    '83.290',
    '84.382',
    '84.590',
  ] as const;
  const expectedShorts = [
    '83.988',
    '83.792',
    '84.336',
    '85.921',
    '85.707',
    '85.559',
    '86.029',
    '85.998',
    '87.720',
    '87.648',
    '87.440',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const ce = new ChandelierExit({interval: 5, multiplier: 3});

      ce.updates(candles, false);

      const originalValue = {close: 89.0, high: 90.0, low: 88.0} as const;
      const replacedValue = {close: 83.0, high: 84.0, low: 82.0} as const;

      const originalResult = ce.add(originalValue);

      expect(originalResult?.long.toFixed(2)).toBe('85.65');
      expect(originalResult?.short.toFixed(2)).toBe('89.74');

      const replacedResult = ce.replace(replacedValue);

      expect(replacedResult?.long.toFixed(2)).toBe('82.10');
      expect(replacedResult?.short.toFixed(2)).toBe('87.90');
      expect(replacedResult).not.toEqual(originalResult);

      const restoredResult = ce.replace(originalValue);

      expect(restoredResult).toEqual(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('hangs the stops from the highest high and lowest low at a distance of three ATRs', () => {
      const ce = new ChandelierExit({interval: 5, multiplier: 3});
      const offset = ce.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = ce.add(candle);

        if (result) {
          expect(result.long.toFixed(3)).toBe(expectedLongs[i - offset]);
          expect(result.short.toFixed(3)).toBe(expectedShorts[i - offset]);
        }
      });

      expect(ce.isStable).toBe(true);
      expect(ce.getRequiredInputs()).toBe(5);
    });

    it('uses an interval of 22 and a multiplier of 3 by default', () => {
      const ce = new ChandelierExit();

      expect(ce.getRequiredInputs()).toBe(22);
      expect(ce.multiplier).toBe(3);
    });

    it('throws an error when there is not enough input data', () => {
      const ce = new ChandelierExit({interval: 5, multiplier: 3});

      try {
        ce.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
