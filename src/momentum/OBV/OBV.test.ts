import {OBV} from './OBV.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TrendSignal} from '../../types/index.js';

describe('OBV', () => {
  describe('getResultOrThrow', () => {
    it('calculates the relative strength index', () => {
      // Test data verified with:
      // https://www.investopedia.com/terms/o/onbalancevolume.asp#mntl-sc-block_1-0-27
      const prices = [10, 10.15, 10.17, 10.13, 10.11, 10.15, 10.2, 10.2, 10.22, 10.21] as const;
      const volumes = [25200, 30000, 25600, 32000, 23000, 40000, 36000, 20500, 23000, 27500] as const;
      const candles = prices.map((price, index) => ({
        close: price,
        high: price,
        low: price,
        open: price,
        volume: volumes[index],
      }));
      const expectations = [
        '30000.000',
        '55600.000',
        '23600.000',
        '600.000',
        '40600.000',
        '76600.000',
        '76600.000',
        '99600.000',
        '72100.000',
      ] as const;
      const obv = new OBV(2);
      const offset = obv.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        obv.add(candle);
        if (obv.isStable) {
          const expected = expectations[i - offset];
          expect(obv.getResultOrThrow().toFixed(3)).toBe(expected);
        }
      });

      expect(obv.isStable).toBe(true);
      expect(obv.getRequiredInputs()).toBe(2);
      expect(obv.getResultOrThrow().toFixed(2)).toBe('72100.00');
    });

    it('throws an error when there is not enough input data', () => {
      const obv = new OBV(2);
      expect(obv.isStable).toBe(false);
      try {
        obv.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(obv.isStable).toBe(false);
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const obv = new OBV(2);
      const signal = obv.getSignal();
      expect(signal.state).toBe(TrendSignal.NA);
    });

    it('returns BULLISH when OBV is increasing', () => {
      const obv = new OBV(2);
      const candles = [
        {close: 100, high: 100, low: 100, open: 100, volume: 1000},
        {close: 101, high: 101, low: 101, open: 101, volume: 1500},
        {close: 102, high: 102, low: 102, open: 102, volume: 2000},
      ] as const;

      for (const candle of candles) {
        obv.add(candle);
      }

      const signal = obv.getSignal();

      expect(signal.state).toBe(TrendSignal.BULLISH);
    });

    it('returns BEARISH when OBV is decreasing', () => {
      const obv = new OBV(2);
      const candles = [
        {close: 102, high: 102, low: 102, open: 102, volume: 2000},
        {close: 101, high: 101, low: 101, open: 101, volume: 1500},
        {close: 100, high: 100, low: 100, open: 100, volume: 1000},
      ] as const;

      for (const candle of candles) {
        obv.add(candle);
      }

      const signal = obv.getSignal();

      expect(signal.state).toBe(TrendSignal.BEARISH);
    });

    it('returns UNKNOWN when OBV has not changed', () => {
      const obv = new OBV(2);
      const candles = [
        {close: 100, high: 100, low: 100, open: 100, volume: 1000},
        {close: 100, high: 100, low: 100, open: 100, volume: 1000},
        {close: 100, high: 100, low: 100, open: 100, volume: 1000},
      ] as const;

      for (const candle of candles) {
        obv.add(candle);
      }

      const signal = obv.getSignal();

      expect(signal.state).toBe(TrendSignal.UNKNOWN);
    });
  });
});
