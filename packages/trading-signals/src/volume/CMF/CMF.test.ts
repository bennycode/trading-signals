import {CMF} from './CMF.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../types/index.js';

describe('CMF', () => {
  describe('getResultOrThrow', () => {
    it('calculates the Chaikin Money Flow', () => {
      // Test data verified with:
      // https://school.stockcharts.com/doku.php?id=technical_indicators:chaikin_money_flow_cmf
      const candles = [
        {close: 62.15, high: 62.34, low: 61.37, volume: 7849},
        {close: 60.81, high: 62.05, low: 60.69, volume: 11692},
        {close: 60.45, high: 62.27, low: 60.1, volume: 10575},
        {close: 59.18, high: 60.79, low: 58.61, volume: 13059},
        {close: 59.24, high: 59.93, low: 58.71, volume: 20734},
      ] as const;

      const cmf = new CMF(5);

      for (const candle of candles) {
        cmf.add(candle);
      }

      expect(cmf.isStable).toBe(true);
      expect(cmf.getRequiredInputs()).toBe(5);

      const result = cmf.getResultOrThrow();

      expect(result).toBeLessThan(0);
    });

    it('throws an error when there is not enough input data', () => {
      const cmf = new CMF(5);
      expect(cmf.isStable).toBe(false);

      try {
        cmf.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('handles candles where high equals low', () => {
      const cmf = new CMF(2);
      cmf.add({close: 10, high: 10, low: 10, volume: 100});
      cmf.add({close: 10, high: 10, low: 10, volume: 100});

      expect(cmf.getResultOrThrow()).toBe(0);
    });

    it('returns 0 when total volume is 0', () => {
      const cmf = new CMF(2);
      cmf.add({close: 8, high: 10, low: 5, volume: 0});
      cmf.add({close: 10, high: 12, low: 6, volume: 0});

      expect(cmf.getResultOrThrow()).toBe(0);
    });
  });

  describe('isStable', () => {
    it('returns true when enough data has been provided', () => {
      const cmf = new CMF(3);
      expect(cmf.isStable).toBe(false);

      cmf.add({close: 8, high: 10, low: 5, volume: 100});
      expect(cmf.isStable).toBe(false);

      cmf.add({close: 10, high: 12, low: 6, volume: 200});
      expect(cmf.isStable).toBe(false);

      cmf.add({close: 9, high: 11, low: 7, volume: 150});
      expect(cmf.isStable).toBe(true);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const cmf = new CMF(5);
      const signal = cmf.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when CMF is positive', () => {
      const cmf = new CMF(3);
      const candles = [
        {close: 109, high: 110, low: 100, volume: 1000},
        {close: 114, high: 115, low: 105, volume: 1500},
        {close: 119, high: 120, low: 110, volume: 2000},
      ] as const;

      for (const candle of candles) {
        cmf.add(candle);
      }

      expect(cmf.getResultOrThrow()).toBeGreaterThan(0);
      expect(cmf.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns SIDEWAYS when CMF is zero', () => {
      const cmf = new CMF(2);
      const candles = [
        {close: 105, high: 110, low: 100, volume: 1000},
        {close: 105, high: 110, low: 100, volume: 1000},
      ] as const;

      for (const candle of candles) {
        cmf.add(candle);
      }

      expect(cmf.getResultOrThrow()).toBe(0);
      expect(cmf.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('returns BEARISH when CMF is negative', () => {
      const cmf = new CMF(3);
      const candles = [
        {close: 101, high: 110, low: 100, volume: 1000},
        {close: 106, high: 115, low: 105, volume: 1500},
        {close: 111, high: 120, low: 110, volume: 2000},
      ] as const;

      for (const candle of candles) {
        cmf.add(candle);
      }

      expect(cmf.getResultOrThrow()).toBeLessThan(0);
      expect(cmf.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const cmf = new CMF(3);
      cmf.add({close: 108, high: 110, low: 100, volume: 1000});
      cmf.add({close: 112, high: 115, low: 105, volume: 1500});

      const originalValue = {close: 119, high: 120, low: 110, volume: 2000} as const;
      const replacedValue = {close: 111, high: 120, low: 110, volume: 2000} as const;

      const originalResult = cmf.add(originalValue);
      const replacedResult = cmf.replace(replacedValue);

      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = cmf.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });
});
