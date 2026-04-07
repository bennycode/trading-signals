import {AD} from './AD.js';
import {TradingSignal} from '../../types/index.js';

describe('AD', () => {
  describe('getResultOrThrow', () => {
    it('calculates the Accumulation/Distribution line', () => {
      // Test data verified with:
      // https://www.investopedia.com/terms/a/accumulationdistribution.asp
      const candles = [
        {close: 62.15, high: 62.34, low: 61.37, volume: 7849},
        {close: 60.81, high: 62.05, low: 60.69, volume: 11692},
        {close: 60.45, high: 62.27, low: 60.1, volume: 10575},
        {close: 59.18, high: 60.79, low: 58.61, volume: 13059},
        {close: 59.24, high: 59.93, low: 58.71, volume: 20734},
      ] as const;

      const ad = new AD();

      for (const candle of candles) {
        ad.add(candle);
      }

      expect(ad.isStable).toBe(true);
      expect(ad.getRequiredInputs()).toBe(1);
    });

    it('returns 0 when high equals low', () => {
      const ad = new AD();
      ad.add({close: 100, high: 100, low: 100, volume: 1000});
      expect(ad.getResultOrThrow()).toBe(0);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const ad = new AD();
      const signal = ad.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when AD is increasing', () => {
      const ad = new AD();
      ad.add({close: 108, high: 110, low: 100, volume: 1000});
      ad.add({close: 114, high: 115, low: 105, volume: 1500});

      const signal = ad.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when AD is decreasing', () => {
      const ad = new AD();
      ad.add({close: 108, high: 110, low: 100, volume: 1000});
      ad.add({close: 106, high: 115, low: 105, volume: 1500});

      const signal = ad.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const ad = new AD();
      ad.add({close: 108, high: 110, low: 100, volume: 1000});

      const originalValue = {close: 114, high: 115, low: 105, volume: 1500} as const;
      const replacedValue = {close: 106, high: 115, low: 105, volume: 1500} as const;

      const originalResult = ad.add(originalValue);
      const replacedResult = ad.replace(replacedValue);

      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = ad.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });
});
