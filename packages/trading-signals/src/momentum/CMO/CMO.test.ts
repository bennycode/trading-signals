import {CMO} from './CMO.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../base/index.js';

describe('CMO', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L109-L111
   */
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = [
    '44.068',
    '53.614',
    '42.105',
    '50.162',
    '28.090',
    '70.414',
    '90.686',
    '88.415',
    '89.444',
    '75.321',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const cmo = new CMO(5);

      cmo.updates(prices, false);

      const originalValue = 90;
      const replacedValue = 83;

      const originalResult = cmo.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('82.32');

      const replacedResult = cmo.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('-36.09');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = cmo.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const cmo = new CMO(interval);
      const offset = cmo.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = cmo.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(cmo.isStable).toBe(true);
      expect(cmo.getRequiredInputs()).toBe(interval + 1);
    });

    it('returns zero when the market has no momentum in either direction', () => {
      const cmo = new CMO(5);

      for (let i = 0; i < 6; i++) {
        cmo.add(100);
      }

      expect(cmo.getResultOrThrow()).toBe(0);
    });

    it('throws an error when there is not enough input data', () => {
      const cmo = new CMO(5);

      try {
        cmo.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const cmo = new CMO(5);

      expect(cmo.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when all price changes are gains', () => {
      const cmo = new CMO(5);

      for (let i = 0; i < 6; i++) {
        cmo.add(100 + i);
      }

      expect(cmo.getResultOrThrow()).toBe(100);
      expect(cmo.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when all price changes are losses', () => {
      const cmo = new CMO(5);

      for (let i = 0; i < 6; i++) {
        cmo.add(100 - i);
      }

      expect(cmo.getResultOrThrow()).toBe(-100);
      expect(cmo.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the CMO is between the oversold and overbought thresholds', () => {
      const cmo = new CMO(5);

      for (let i = 0; i < 6; i++) {
        cmo.add(100);
      }

      expect(cmo.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const sensitiveBull = new CMO(5, {overbought: 0});
      const sensitiveBear = new CMO(5, {oversold: 0});

      for (let i = 0; i < 6; i++) {
        sensitiveBull.add(100);
        sensitiveBear.add(100);
      }

      expect(sensitiveBull.getResultOrThrow()).toBe(0);
      expect(sensitiveBull.getSignal().state).toBe(TradingSignal.BULLISH);
      expect(sensitiveBear.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});
