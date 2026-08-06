import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {PVT} from './PVT.js';
import {TradingSignal} from '../../base/index.js';

describe('PVT', () => {
  describe('getResultOrThrow', () => {
    it('calculates the Price Volume Trend', () => {
      /*
       * Test data verified with:
       * https://www.investopedia.com/terms/p/pvt.asp
       */
      const candles = [
        {close: 10, high: 10, low: 9, volume: 25000},
        {close: 10.5, high: 11, low: 9.5, volume: 30000},
        {close: 10.2, high: 10.8, low: 10, volume: 28000},
        {close: 10.3, high: 10.5, low: 9.8, volume: 26000},
      ] as const;

      const pvt = new PVT();

      pvt.updates(candles);

      expect(pvt.isStable).toBe(true);
      expect(pvt.getRequiredInputs()).toBe(2);

      /*
       * First result: PVT = 0 + 30000 * ((10.5 - 10) / 10) = 1500
       * Second result: PVT = 1500 + 28000 * ((10.2 - 10.5) / 10.5) = 1500 - 800 = 700
       * Third result: PVT = 700 + 26000 * ((10.3 - 10.2) / 10.2) ≈ 700 + 254.9... ≈ 954.9...
       */
    });

    it('handles zero previous close gracefully', () => {
      const pvt = new PVT();
      pvt.add({close: 0, high: 0, low: 0, volume: 25000});
      pvt.add({close: 10, high: 10, low: 9, volume: 30000});

      expect(pvt.isStable).toBe(true);
      expect(pvt.getResultOrThrow()).toBe(0);
    });
  });

  describe('isStable', () => {
    it('returns true when enough data has been provided', () => {
      const pvt = new PVT();
      expect(pvt.isStable).toBe(false);

      pvt.add({close: 10, high: 10, low: 9, volume: 25000});
      expect(pvt.isStable).toBe(false);

      pvt.add({close: 10.5, high: 11, low: 9.5, volume: 30000});
      expect(pvt.isStable).toBe(true);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const pvt = new PVT();
      const signal = pvt.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when PVT is increasing', () => {
      const pvt = new PVT();
      const candles = [
        {close: 10, high: 10, low: 9, volume: 25000},
        {close: 10.5, high: 11, low: 9.5, volume: 30000},
        {close: 11.5, high: 12, low: 10, volume: 35000},
      ] as const;

      pvt.updates(candles);

      expect(pvt.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when PVT is decreasing', () => {
      const pvt = new PVT();
      const candles = [
        {close: 11.5, high: 12, low: 10, volume: 35000},
        {close: 10.5, high: 11, low: 9.5, volume: 30000},
        {close: 9.5, high: 10, low: 9, volume: 25000},
      ] as const;

      pvt.updates(candles);

      expect(pvt.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });

  describe('replace', () => {
    /** Keeps the tests focused on the close price by faking a candle that has no intra-bar movement. */
    const fakeFlatCandle = (close: number) => ({close, high: close, low: close, volume: 1000}) as const;

    it('accumulates onto the total from before the replaced candle', () => {
      const replaced = new PVT();
      replaced.updates([fakeFlatCandle(100), fakeFlatCandle(110), fakeFlatCandle(120)]);
      replaced.replace(fakeFlatCandle(130));

      const reference = new PVT();
      reference.updates([fakeFlatCandle(100), fakeFlatCandle(110), fakeFlatCandle(130)]);

      expect(replaced.getResultOrThrow(), 'a replacement must not count the replaced candle twice').toBe(
        reference.getResultOrThrow()
      );
    });

    it('changes nothing when the latest candle is replaced with the same values', () => {
      const pvt = new PVT();

      pvt.updates([fakeFlatCandle(100), fakeFlatCandle(110), fakeFlatCandle(120)]);

      const resultBefore = pvt.getResultOrThrow();

      pvt.replace(fakeFlatCandle(120));

      expect(pvt.getResultOrThrow(), 'replacing a candle with itself is a no-op').toBe(resultBefore);
    });

    it('replaces the most recently added value', () => {
      const pvt = new PVT();
      pvt.add({close: 10, high: 10, low: 9, volume: 25000});

      const originalValue = {close: 10.5, high: 11, low: 9.5, volume: 30000} as const;
      const replacedValue = {close: 9.5, high: 11, low: 9.5, volume: 30000} as const;

      const originalResult = pvt.add(originalValue);
      const replacedResult = pvt.replace(replacedValue);

      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = pvt.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });
});

testIndicatorContract({
  create: () => new PVT(),
  divergentInput: {close: 500, high: 500, low: 500, volume: 99_000},
  inputs: [
    {close: 10, high: 10, low: 9, volume: 25_000},
    {close: 10.5, high: 11, low: 9.5, volume: 30_000},
    {close: 10.2, high: 10.8, low: 10, volume: 28_000},
    {close: 10.3, high: 10.5, low: 9.8, volume: 26_000},
  ],
});
