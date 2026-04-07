import {EMV} from './EMV.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../types/index.js';

describe('EMV', () => {
  describe('getResultOrThrow', () => {
    it('calculates the Ease of Movement', () => {
      const candles = [
        {close: 62.15, high: 62.34, low: 61.37, volume: 7849},
        {close: 60.81, high: 62.05, low: 60.69, volume: 11692},
        {close: 60.45, high: 62.27, low: 60.1, volume: 10575},
        {close: 59.18, high: 60.79, low: 58.61, volume: 13059},
        {close: 59.24, high: 59.93, low: 58.71, volume: 20734},
        {close: 60.2, high: 61.75, low: 59.86, volume: 29630},
        {close: 58.48, high: 60.0, low: 57.97, volume: 17705},
      ] as const;

      const emv = new EMV(5);

      for (const candle of candles) {
        emv.add(candle);
      }

      expect(emv.isStable).toBe(true);
      expect(emv.getRequiredInputs()).toBe(6);
    });

    it('throws an error when there is not enough input data', () => {
      const emv = new EMV(5);
      expect(emv.isStable).toBe(false);

      try {
        emv.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('returns true when enough data has been provided', () => {
      const emv = new EMV(3);
      expect(emv.isStable).toBe(false);

      const candles = [
        {close: 8, high: 10, low: 5, volume: 100_000_000},
        {close: 10, high: 12, low: 6, volume: 200_000_000},
        {close: 12, high: 14, low: 8, volume: 150_000_000},
        {close: 14, high: 16, low: 10, volume: 250_000_000},
      ] as const;

      candles.forEach((candle, i) => {
        emv.add(candle);

        if (i < 3) {
          expect(emv.isStable).toBe(false);
        }
      });

      expect(emv.isStable).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles candles where high equals low', () => {
      const emv = new EMV(2);
      emv.add({close: 45, high: 50, low: 40, volume: 100_000_000});
      emv.add({close: 50, high: 50, low: 50, volume: 100_000_000});
      emv.add({close: 50, high: 50, low: 50, volume: 100_000_000});

      expect(emv.isStable).toBe(true);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const emv = new EMV(5);
      const signal = emv.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when EMV is positive', () => {
      const emv = new EMV(2);
      const candles = [
        {close: 45, high: 50, low: 40, volume: 100_000_000},
        {close: 50, high: 55, low: 45, volume: 100_000_000},
        {close: 55, high: 60, low: 50, volume: 100_000_000},
      ] as const;

      for (const candle of candles) {
        emv.add(candle);
      }

      expect(emv.getResultOrThrow()).toBeGreaterThan(0);
      expect(emv.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns SIDEWAYS when EMV is zero', () => {
      const emv = new EMV(2);
      const candles = [
        {close: 45, high: 50, low: 40, volume: 100_000_000},
        {close: 45, high: 50, low: 40, volume: 100_000_000},
        {close: 45, high: 50, low: 40, volume: 100_000_000},
      ] as const;

      for (const candle of candles) {
        emv.add(candle);
      }

      expect(emv.getResultOrThrow()).toBe(0);
      expect(emv.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('returns BEARISH when EMV is negative', () => {
      const emv = new EMV(2);
      const candles = [
        {close: 55, high: 60, low: 50, volume: 100_000_000},
        {close: 50, high: 55, low: 45, volume: 100_000_000},
        {close: 45, high: 50, low: 40, volume: 100_000_000},
      ] as const;

      for (const candle of candles) {
        emv.add(candle);
      }

      expect(emv.getResultOrThrow()).toBeLessThan(0);
      expect(emv.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const emv = new EMV(2);
      emv.add({close: 45, high: 50, low: 40, volume: 100_000_000});
      emv.add({close: 50, high: 55, low: 45, volume: 100_000_000});

      const originalValue = {close: 55, high: 60, low: 50, volume: 100_000_000} as const;
      const replacedValue = {close: 42, high: 50, low: 40, volume: 100_000_000} as const;

      const originalResult = emv.add(originalValue);
      const replacedResult = emv.replace(replacedValue);

      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = emv.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });
});
