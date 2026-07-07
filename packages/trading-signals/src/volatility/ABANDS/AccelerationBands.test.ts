import {EMA} from '../../trend/EMA/EMA.js';
import {NotEnoughDataError} from '../../error/index.js';
import {SMA} from '../../trend/SMA/SMA.js';
import {TradingSignal} from '../../types/Indicator.js';
import {AccelerationBands} from './AccelerationBands.js';

describe('AccelerationBands', () => {
  describe('constructor', () => {
    it('works with different kinds of indicators', () => {
      const accBandsWithSMA = new AccelerationBands(20, 2, SMA);
      const accBandsWithEMA = new AccelerationBands(20, 2, EMA);
      expect(accBandsWithSMA).toBeDefined();
      expect(accBandsWithEMA).toBeDefined();
    });
  });

  describe('getResultOrThrow', () => {
    it('returns upper, middle and lower bands', () => {
      const interval = 20;
      const accBands = new AccelerationBands(interval, 4);
      const offset = accBands.getRequiredInputs() - 1;

      // Test data from: https://github.com/QuantConnect/Lean/blob/master/Tests/TestData/spy_acceleration_bands_20_4.txt
      const candles = [
        {close: 195.55, high: 198.05, low: 194.96, open: 196.25},
        {close: 192.59, high: 193.86, low: 191.61, open: 192.88},
        {close: 197.43, high: 197.61, low: 195.17, open: 195.97},
        {close: 194.79, high: 199.47, low: 194.35, open: 199.32},
        {close: 195.85, high: 197.22, low: 194.25, open: 194.5},
        {close: 196.74, high: 196.82, low: 194.53, open: 195.32},
        {close: 196.01, high: 197.01, low: 195.43, open: 196.95},
        {close: 198.46, high: 198.99, low: 195.96, open: 196.59},
        {close: 200.18, high: 200.41, low: 198.41, open: 198.82},
        {close: 199.73, high: 202.89, low: 199.28, open: 199.96},
        {close: 195.45, high: 198.68, low: 194.96, open: 195.74},
        {close: 196.46, high: 197.68, low: 195.21, open: 196.45},
        {close: 193.91, high: 194.46, low: 192.56, open: 193.9},
        {close: 193.6, high: 194.67, low: 192.91, open: 194.13},
        {close: 192.9, high: 193.45, low: 190.56, open: 192.13},
        {close: 192.85, high: 195, low: 191.81, open: 194.61},
        {close: 188.01, high: 191.91, low: 187.64, open: 191.75},
        {close: 188.12, high: 189.74, low: 186.93, open: 188.24},
        {close: 191.63, high: 191.83, low: 189.44, open: 190.4},
        {close: 192.13, high: 192.49, low: 189.82, open: 192.03},
      ] as const;

      candles.forEach(({close, high, low}, index) => {
        accBands.add({close, high, low});

        expect(accBands.isStable).toBe(index >= offset);
      });

      let result = accBands.getResultOrThrow();

      // See: https://github.com/QuantConnect/Lean/blob/master/Tests/TestData/spy_acceleration_bands_20_4.txt#L21
      expect(accBands.isStable).toBe(true);
      expect(accBands.getRequiredInputs()).toBe(interval);
      expect(result.lower.toFixed(4)).toBe('187.6891');
      expect(result.middle.toFixed(4)).toBe('194.6195');
      expect(result.upper.toFixed(4)).toBe('201.8016');

      // See: https://github.com/QuantConnect/Lean/blob/master/Tests/TestData/spy_acceleration_bands_20_4.txt#L22
      const candle = {close: 195, high: 195.03, low: 189.12};
      accBands.add(candle);
      result = accBands.getResultOrThrow();
      expect(result.lower.toFixed(4)).toBe('187.1217');
      expect(result.middle.toFixed(4)).toBe('194.5920');
      expect(result.upper.toFixed(4)).toBe('201.9392');
    });

    it('throws an error when there is not enough input data', () => {
      const accBands = new AccelerationBands(20, 2);
      try {
        accBands.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const accBands = new AccelerationBands(5, 4);

      for (let i = 0; i < 5; i++) {
        accBands.add({close: 50 + i, high: 60, low: 40});
      }

      const originalValue = {close: 55, high: 60, low: 40} as const;
      const replacedValue = {close: 45, high: 60, low: 40} as const;

      const originalResult = accBands.add(originalValue);
      const replacedResult = accBands.replace(replacedValue);

      expect(replacedResult?.middle).not.toBe(originalResult?.middle);

      const restoredResult = accBands.replace(originalValue);

      expect(restoredResult?.lower).toBe(originalResult?.lower);
      expect(restoredResult?.middle).toBe(originalResult?.middle);
      expect(restoredResult?.upper).toBe(originalResult?.upper);
    });
  });

  describe('update', () => {
    it("doesn't crash when supplying zeroes", () => {
      const accBands = new AccelerationBands(20, 2);
      return accBands.updates(
        [
          {
            close: 0,
            high: 0,
            low: 0,
          },
        ],
        false
      );
    });
  });

  describe('updates', () => {
    it("doesn't crash when supplying zeroes", () => {
      const accBands = new AccelerationBands(20, 2);
      return accBands.updates(
        [
          {
            close: 0,
            high: 0,
            low: 0,
          },
        ],
        false
      );
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const accBands = new AccelerationBands(5, 4);
      const signal = accBands.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when the close breaks above the upper band', () => {
      const accBands = new AccelerationBands(5, 4);

      // Fill the interval with flat candles so the bands stay narrow around 50
      for (let i = 0; i < 5; i++) {
        accBands.add({close: 50, high: 51, low: 49});
      }

      accBands.add({close: 80, high: 81, low: 79});
      const signal = accBands.getSignal();
      expect(signal.state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the close breaks below the lower band', () => {
      const accBands = new AccelerationBands(5, 4);

      for (let i = 0; i < 5; i++) {
        accBands.add({close: 50, high: 51, low: 49});
      }

      accBands.add({close: 20, high: 21, low: 19});
      const signal = accBands.getSignal();
      expect(signal.state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the close stays between the bands', () => {
      const accBands = new AccelerationBands(5, 4);

      for (let i = 0; i < 5; i++) {
        accBands.add({close: 50, high: 51, low: 49});
      }

      accBands.add({close: 50, high: 51, low: 49});
      const signal = accBands.getSignal();
      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
    });

    it('tracks signal state changes', () => {
      const accBands = new AccelerationBands(5, 4);

      // Flat candles keep the bands narrow around 50
      for (let i = 0; i < 6; i++) {
        accBands.add({close: 50, high: 51, low: 49});
      }

      expect(accBands.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      // Spike up: the close escapes the bands to the upside
      accBands.add({close: 80, high: 81, low: 79});
      const signal = accBands.getSignal();
      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('restores previous signal state on replace', () => {
      const accBands = new AccelerationBands(5, 4);

      for (let i = 0; i < 6; i++) {
        accBands.add({close: 50, high: 51, low: 49});
      }

      expect(accBands.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      // Add a spike, then replace it with a normal value
      accBands.add({close: 80, high: 81, low: 79});
      expect(accBands.getSignal().state).toBe(TradingSignal.BULLISH);

      const signal = accBands.getSignal();
      accBands.replace({close: 50, high: 51, low: 49});
      const restoredSignal = accBands.getSignal();

      expect(signal.hasChanged).toBe(true);
      expect(restoredSignal.state).toBe(TradingSignal.SIDEWAYS);
      expect(restoredSignal.hasChanged).toBe(false);
    });
  });
});
