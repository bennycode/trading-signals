import {VWMA} from './VWMA.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../types/index.js';
import {EMA} from '../../trend/EMA/EMA.js';

describe('VWMA', () => {
  describe('getResultOrThrow', () => {
    it('calculates the Volume Weighted Moving Average', () => {
      // Price 10 * Volume 100 = 1000
      // Price 12 * Volume 200 = 2400
      // Price 11 * Volume 150 = 1650
      // Sum PV = 5050, Sum V = 450, VWMA = 5050/450 = 11.222...
      const candles = [
        {close: 10, high: 11, low: 9, volume: 100},
        {close: 12, high: 13, low: 11, volume: 200},
        {close: 11, high: 12, low: 10, volume: 150},
      ] as const;

      const vwma = new VWMA(3);

      for (const candle of candles) {
        vwma.add(candle);
      }

      expect(vwma.isStable).toBe(true);
      expect(vwma.getRequiredInputs()).toBe(3);
      expect(vwma.getResultOrThrow().toFixed(4)).toBe('11.2222');
    });

    it('weights higher-volume bars more heavily', () => {
      const candlesEvenVolume = [
        {close: 10, high: 11, low: 9, volume: 100},
        {close: 20, high: 13, low: 11, volume: 100},
      ] as const;

      const candlesHighVolumeOnSecond = [
        {close: 10, high: 11, low: 9, volume: 100},
        {close: 20, high: 13, low: 11, volume: 1000},
      ] as const;

      const vwmaEven = new VWMA(2);
      const vwmaWeighted = new VWMA(2);

      for (const candle of candlesEvenVolume) {
        vwmaEven.add(candle);
      }

      for (const candle of candlesHighVolumeOnSecond) {
        vwmaWeighted.add(candle);
      }

      expect(vwmaWeighted.getResultOrThrow()).toBeGreaterThan(vwmaEven.getResultOrThrow());
    });

    it('throws an error when there is not enough input data', () => {
      const vwma = new VWMA(5);
      expect(vwma.isStable).toBe(false);

      try {
        vwma.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('returns null when all volumes are zero', () => {
      const vwma = new VWMA(2);
      vwma.add({close: 8, high: 10, low: 5, volume: 0});
      const result = vwma.add({close: 10, high: 12, low: 6, volume: 0});

      expect(result).toBeNull();
    });
  });

  describe('isStable', () => {
    it('returns true when enough data has been provided', () => {
      const vwma = new VWMA(3);
      expect(vwma.isStable).toBe(false);

      vwma.add({close: 8, high: 10, low: 5, volume: 100});
      expect(vwma.isStable).toBe(false);

      vwma.add({close: 10, high: 12, low: 6, volume: 200});
      expect(vwma.isStable).toBe(false);

      vwma.add({close: 9, high: 11, low: 7, volume: 150});
      expect(vwma.isStable).toBe(true);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const vwma = new VWMA(3);
      const signal = vwma.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns SIDEWAYS when the signal line is not yet stable', () => {
      const vwma = new VWMA(2, undefined, 5);
      vwma.add({close: 10, high: 11, low: 9, volume: 100});
      vwma.add({close: 12, high: 13, low: 11, volume: 200});

      const signal = vwma.getSignal();

      expect(vwma.isStable).toBe(true);
      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
    });

    it('returns BULLISH when VWMA is above the signal line', () => {
      // Use a short VWMA with a longer signal line so VWMA reacts faster
      const vwma = new VWMA(2, undefined, 3);
      const candles = [
        {close: 10, high: 11, low: 9, volume: 100},
        {close: 12, high: 13, low: 11, volume: 200},
        {close: 14, high: 15, low: 13, volume: 300},
        {close: 16, high: 17, low: 15, volume: 400},
        {close: 18, high: 19, low: 17, volume: 500},
      ] as const;

      for (const candle of candles) {
        vwma.add(candle);
      }

      const signal = vwma.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when VWMA is below the signal line', () => {
      const vwma = new VWMA(2, undefined, 3);
      const candles = [
        {close: 18, high: 19, low: 17, volume: 500},
        {close: 16, high: 17, low: 15, volume: 400},
        {close: 14, high: 15, low: 13, volume: 300},
        {close: 12, high: 13, low: 11, volume: 200},
        {close: 10, high: 11, low: 9, volume: 100},
      ] as const;

      for (const candle of candles) {
        vwma.add(candle);
      }

      const signal = vwma.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when VWMA equals the signal line', () => {
      // With interval=1 and signalInterval=1, VWMA always equals signal
      const vwma = new VWMA(1, undefined, 1);
      vwma.add({close: 10, high: 10, low: 10, volume: 100});

      const signal = vwma.getSignal();

      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
    });

    it('accepts a custom signal line indicator', () => {
      const vwma = new VWMA(2, EMA, 3);
      const candles = [
        {close: 10, high: 11, low: 9, volume: 100},
        {close: 12, high: 13, low: 11, volume: 200},
        {close: 14, high: 15, low: 13, volume: 300},
        {close: 16, high: 17, low: 15, volume: 400},
        {close: 18, high: 19, low: 17, volume: 500},
      ] as const;

      for (const candle of candles) {
        vwma.add(candle);
      }

      const signal = vwma.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const vwma = new VWMA(3);
      vwma.add({close: 10, high: 11, low: 9, volume: 100});
      vwma.add({close: 12, high: 13, low: 11, volume: 200});

      const originalValue = {close: 11, high: 12, low: 10, volume: 150} as const;
      const replacedValue = {close: 14, high: 15, low: 12, volume: 300} as const;

      const originalResult = vwma.add(originalValue);
      const replacedResult = vwma.replace(replacedValue);

      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = vwma.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });
});
