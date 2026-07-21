import {NotEnoughDataError} from '../../error/NotEnoughDataError.js';
import {TradingSignal} from '../../types/Indicator.js';
import {BullishEngulfing} from './BullishEngulfing.js';

describe('BullishEngulfing', () => {
  describe('add', () => {
    it('detects a bullish candle whose body engulfs the previous bearish body', () => {
      const candles = [
        {close: 95, high: 101, low: 94, open: 100},
        {close: 102, high: 103, low: 93, open: 94},
      ] as const;
      const expectations = [null, 1] as const;
      const bullishEngulfing = new BullishEngulfing();

      candles.forEach((candle, i) => {
        const result = bullishEngulfing.add(candle);
        expect(result).toBe(expectations[i]);
      });

      expect(bullishEngulfing.isStable).toBe(true);
      expect(bullishEngulfing.getResultOrThrow()).toBe(1);
    });

    it('returns 0 when the previous candle is not bearish', () => {
      const candles = [
        {close: 100, high: 101, low: 94, open: 95},
        {close: 102, high: 103, low: 93, open: 94},
      ] as const;
      const expectations = [null, 0] as const;
      const bullishEngulfing = new BullishEngulfing();

      candles.forEach((candle, i) => {
        const result = bullishEngulfing.add(candle);
        expect(result).toBe(expectations[i]);
      });
    });

    it('returns 0 when the previous candle has no real body', () => {
      const candles = [
        {close: 100, high: 101, low: 94, open: 100},
        {close: 102, high: 103, low: 93, open: 94},
      ] as const;
      const expectations = [null, 0] as const;
      const bullishEngulfing = new BullishEngulfing();

      candles.forEach((candle, i) => {
        const result = bullishEngulfing.add(candle);
        expect(result).toBe(expectations[i]);
      });
    });

    it('returns 0 when the current body does not fully engulf the previous body', () => {
      const candles = [
        {close: 95, high: 101, low: 94, open: 100},
        {close: 99, high: 100, low: 95, open: 96},
      ] as const;
      const expectations = [null, 0] as const;
      const bullishEngulfing = new BullishEngulfing();

      candles.forEach((candle, i) => {
        const result = bullishEngulfing.add(candle);
        expect(result).toBe(expectations[i]);
      });
    });

    it('ignores wicks because engulfing is measured on real bodies only', () => {
      const candles = [
        {close: 95, high: 110, low: 90, open: 100},
        {close: 102, high: 103, low: 93, open: 94},
      ] as const;
      const expectations = [null, 1] as const;
      const bullishEngulfing = new BullishEngulfing();

      candles.forEach((candle, i) => {
        const result = bullishEngulfing.add(candle);
        expect(result).toBe(expectations[i]);
      });
    });

    it('throws a NotEnoughDataError when fewer than two candles were added', () => {
      const bullishEngulfing = new BullishEngulfing();

      bullishEngulfing.add({close: 95, high: 101, low: 94, open: 100});

      expect(() => bullishEngulfing.getResultOrThrow()).toThrow(NotEnoughDataError);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added candle', () => {
      const bullishEngulfing = new BullishEngulfing();

      bullishEngulfing.add({close: 95, high: 101, low: 94, open: 100});

      const originalCandle = {close: 99, high: 100, low: 95, open: 96} as const;
      const replacementCandle = {close: 102, high: 103, low: 93, open: 94} as const;

      const originalResult = bullishEngulfing.add(originalCandle);
      const replacedResult = bullishEngulfing.replace(replacementCandle);

      expect(originalResult).toBe(0);
      expect(replacedResult).toBe(1);

      const restoredResult = bullishEngulfing.replace(originalCandle);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('turns bullish with a change notice when the pattern completes', () => {
      const candles = [
        {close: 100, high: 101, low: 94, open: 95},
        {close: 95, high: 101, low: 94, open: 100},
        {close: 102, high: 103, low: 93, open: 94},
      ] as const;
      const bullishEngulfing = new BullishEngulfing();

      for (const candle of candles) {
        bullishEngulfing.add(candle);
      }

      const signal = bullishEngulfing.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('reports an unknown state before the pattern window is filled', () => {
      const bullishEngulfing = new BullishEngulfing();

      bullishEngulfing.add({close: 95, high: 101, low: 94, open: 100});

      const signal = bullishEngulfing.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });
  });
});
