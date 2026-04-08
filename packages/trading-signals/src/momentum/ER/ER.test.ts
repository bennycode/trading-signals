import {ER} from './ER.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../types/Indicator.js';

describe('ER', () => {
  describe('getResultOrThrow', () => {
    it('returns high efficiency for a trending asset', () => {
      const er = new ER(5);

      const candles = [
        {close: 100, high: 101, low: 99},
        {close: 102, high: 103, low: 101},
        {close: 104, high: 105, low: 103},
        {close: 106, high: 107, low: 105},
        {close: 108, high: 109, low: 107},
      ] as const;

      for (const candle of candles) {
        er.add(candle);
      }

      // Net change: |108 - 100| = 8, Range: 109 - 99 = 10, ER = 0.8
      expect(er.getResultOrThrow()).toBe(0.8);
    });

    it('returns low efficiency for a choppy asset', () => {
      const er = new ER(5);

      const candles = [
        {close: 100, high: 105, low: 95},
        {close: 95, high: 105, low: 90},
        {close: 105, high: 110, low: 90},
        {close: 90, high: 110, low: 85},
        {close: 101, high: 110, low: 85},
      ] as const;

      for (const candle of candles) {
        er.add(candle);
      }

      // Net change: |101 - 100| = 1, Range: 110 - 85 = 25, ER = 0.04
      expect(er.getResultOrThrow()).toBe(0.04);
    });

    it('returns 0 when net change is zero', () => {
      const er = new ER(3);

      const candles = [
        {close: 100, high: 110, low: 90},
        {close: 105, high: 115, low: 95},
        {close: 100, high: 110, low: 90},
      ] as const;

      for (const candle of candles) {
        er.add(candle);
      }

      expect(er.getResultOrThrow()).toBe(0);
    });

    it('returns 0 when range is zero (flat prices)', () => {
      const er = new ER(3);

      const candles = [
        {close: 100, high: 100, low: 100},
        {close: 100, high: 100, low: 100},
        {close: 100, high: 100, low: 100},
      ] as const;

      for (const candle of candles) {
        er.add(candle);
      }

      expect(er.getResultOrThrow()).toBe(0);
    });

    it('throws an error when there is not enough input data', () => {
      const er = new ER(5);

      try {
        er.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('becomes stable after receiving enough candles', () => {
      const er = new ER(3);

      expect(er.isStable).toBe(false);

      er.add({close: 100, high: 101, low: 99});
      expect(er.isStable).toBe(false);

      er.add({close: 102, high: 103, low: 101});
      expect(er.isStable).toBe(false);

      er.add({close: 104, high: 105, low: 103});
      expect(er.isStable).toBe(true);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const er = new ER(5);

      expect(er.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when efficiency >= 0.5 (trending)', () => {
      const er = new ER(3);

      const candles = [
        {close: 100, high: 101, low: 99},
        {close: 103, high: 104, low: 102},
        {close: 106, high: 107, low: 105},
      ] as const;

      for (const candle of candles) {
        er.add(candle);
      }

      expect(er.getResultOrThrow()).toBeGreaterThanOrEqual(0.5);
      expect(er.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns SIDEWAYS when efficiency < 0.5 (choppy)', () => {
      const er = new ER(5);

      const candles = [
        {close: 100, high: 105, low: 95},
        {close: 95, high: 105, low: 90},
        {close: 105, high: 110, low: 90},
        {close: 90, high: 110, low: 85},
        {close: 101, high: 110, low: 85},
      ] as const;

      for (const candle of candles) {
        er.add(candle);
      }

      expect(er.getResultOrThrow()).toBeLessThan(0.5);
      expect(er.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const er = new ER(3);

      er.add({close: 100, high: 101, low: 99});
      er.add({close: 102, high: 103, low: 101});

      const originalValue = {close: 104, high: 105, low: 103} as const;
      const replacedValue = {close: 100, high: 105, low: 99} as const;

      const originalResult = er.add(originalValue);
      const replacedResult = er.replace(replacedValue);

      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = er.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getRequiredInputs', () => {
    it('returns the interval', () => {
      const er = new ER(20);

      expect(er.getRequiredInputs()).toBe(20);
    });
  });
});
