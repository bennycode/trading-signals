import {TRIX} from './TRIX.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../base/index.js';

describe('TRIX', () => {
  /*
   * Input data taken from the Tulip Indicators test suite:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L422-L424
   *
   * The expected values differ from Tulip's (0.492, 0.512) because Tulip divides the change by the
   * CURRENT triple EMA while the textbook definition (TA-Lib, TradingView, StockCharts) divides by
   * the PREVIOUS one:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/indicators/trix.c#L69
   * This implementation follows the textbook definition.
   */
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = ['0.495', '0.515'] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const trix = new TRIX(5);

      trix.updates(prices, false);

      const originalValue = 90;
      const replacedValue = 83;

      const originalResult = trix.add(originalValue);

      expect(originalResult?.toFixed(3)).toBe('0.609');

      const replacedResult = trix.replace(replacedValue);

      expect(replacedResult?.toFixed(3)).toBe('0.303');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = trix.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the percent change of the triple smoothed EMA', () => {
      const interval = 5;
      const trix = new TRIX(interval);
      const offset = trix.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = trix.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(trix.isStable).toBe(true);
      expect(trix.getRequiredInputs()).toBe(14);
    });

    it('never produces a result when the triple EMA has no value to change from', () => {
      const trix = new TRIX(5);

      for (let i = 0; i < 14; i++) {
        trix.add(0);
      }

      try {
        trix.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('throws an error when there is not enough input data', () => {
      const trix = new TRIX(5);

      try {
        trix.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const trix = new TRIX(5);

      expect(trix.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when the triple EMA is rising', () => {
      const trix = new TRIX(5);

      for (let i = 0; i < 14; i++) {
        trix.add(100 + i);
      }

      expect(trix.getResultOrThrow()).toBeGreaterThan(0);
      expect(trix.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the triple EMA is falling', () => {
      const trix = new TRIX(5);

      for (let i = 0; i < 14; i++) {
        trix.add(100 - i);
      }

      expect(trix.getResultOrThrow()).toBeLessThan(0);
      expect(trix.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the triple EMA is unchanged', () => {
      const trix = new TRIX(5);

      for (let i = 0; i < 14; i++) {
        trix.add(100);
      }

      expect(trix.getResultOrThrow()).toBe(0);
      expect(trix.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });
});
