import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {ATR} from '../../volatility/ATR/ATR.js';
import {ChandeKrollStop} from './ChandeKrollStop.js';

describe('ChandeKrollStop', () => {
  /*
   * Expected values hand-derived on the library's own ATR (Wilder smoothing, the same recursion as
   * TradingView's RMA-based ATR): preliminary short stop = highest high(5) − 2 × ATR(5), preliminary
   * long stop = lowest low(5) + 2 × ATR(5), final short/long stop = highest/lowest preliminary stop
   * of the last 3 bars. Formulation from Tushar Chande & Stanley Kroll, "The New Technical Trader"
   * (Wiley, 1994), following TradingView's built-in two-pass structure:
   * https://www.tradingview.com/support/solutions/43000589105-chande-kroll-stop/
   */
  const candles = [
    {close: 81.59, high: 82.15, low: 81.29},
    {close: 81.06, high: 81.89, low: 80.64},
    {close: 82.87, high: 83.03, low: 81.31},
    {close: 83.0, high: 83.3, low: 82.65},
    {close: 83.61, high: 83.85, low: 83.07},
    {close: 83.15, high: 83.9, low: 83.11},
    {close: 82.84, high: 83.33, low: 82.49},
    {close: 83.99, high: 84.3, low: 82.3},
    {close: 84.55, high: 84.84, low: 84.15},
    {close: 84.36, high: 85.0, low: 84.11},
    {close: 85.53, high: 85.9, low: 84.03},
    {close: 86.54, high: 86.58, low: 85.39},
    {close: 86.89, high: 86.98, low: 85.76},
    {close: 87.77, high: 88.0, low: 87.17},
    {close: 87.29, high: 87.87, low: 87.01},
  ] as const;
  const expectedLongStops = [
    '82.742',
    '82.742',
    '83.327',
    '84.473',
    '84.473',
    '84.473',
    '84.765',
    '84.765',
    '86.304',
  ] as const;
  const expectedShortStops = [
    '81.883',
    '81.886',
    '82.569',
    '82.827',
    '83.414',
    '84.115',
    '84.520',
    '85.588',
    '85.726',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const cks = new ChandeKrollStop({interval: 5, multiplier: 2, stopInterval: 3});

      for (const candle of candles) {
        cks.add(candle);
      }

      const originalValue = {close: 89.0, high: 90.0, low: 88.0} as const;
      const replacedValue = {close: 83.0, high: 84.0, low: 82.0} as const;

      const originalResult = cks.add(originalValue);

      expect(originalResult?.longStop.toFixed(2)).toBe('86.30');
      expect(originalResult?.shortStop.toFixed(2)).toBe('87.10');

      const replacedResult = cks.replace(replacedValue);

      expect(replacedResult?.longStop.toFixed(2)).toBe('85.93');
      expect(replacedResult?.shortStop.toFixed(2)).toBe('85.73');
      expect(replacedResult).not.toEqual(originalResult);

      const restoredResult = cks.replace(originalValue);

      expect(restoredResult).toEqual(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('hangs the preliminary stops two ATRs off the window extremes and reports the most conservative of the last three', () => {
      const cks = new ChandeKrollStop({interval: 5, multiplier: 2, stopInterval: 3});
      const offset = cks.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = cks.add(candle);

        if (result) {
          expect(result.longStop.toFixed(3)).toBe(expectedLongStops[i - offset]);
          expect(result.shortStop.toFixed(3)).toBe(expectedShortStops[i - offset]);
        }
      });

      expect(cks.isStable).toBe(true);
      expect(cks.getRequiredInputs()).toBe(7);
    });

    it('derives its stop lines from the library ATR and the running window extremes', () => {
      const interval = 4;
      const multiplier = 1.5;
      const stopInterval = 5;
      const cks = new ChandeKrollStop({interval, multiplier, stopInterval});
      const atr = new ATR(interval);
      const preliminaryLongStops: number[] = [];
      const preliminaryShortStops: number[] = [];

      candles.forEach((candle, i) => {
        const result = cks.add(candle);
        const atrResult = atr.add(candle);

        // The ATR only turns stable once a full window of candles exists, so the slice never starts below zero
        if (atrResult !== null) {
          const window = candles.slice(i - interval + 1, i + 1);
          const highestHigh = Math.max(...window.map(({high}) => high));
          const lowestLow = Math.min(...window.map(({low}) => low));

          preliminaryLongStops.push(lowestLow + multiplier * atrResult);
          preliminaryShortStops.push(highestHigh - multiplier * atrResult);
        }

        if (preliminaryLongStops.length >= stopInterval) {
          expect(result).toEqual({
            longStop: Math.min(...preliminaryLongStops.slice(-stopInterval)),
            shortStop: Math.max(...preliminaryShortStops.slice(-stopInterval)),
          });
        } else {
          expect(result).toBeNull();
        }
      });

      expect(cks.isStable).toBe(true);
    });

    it('holds a stop at the level set while a price spike was still inside the lookback', () => {
      const spikeCandles = [
        {close: 11, high: 12, low: 10},
        {close: 12, high: 13, low: 11},
        {close: 13, high: 14, low: 12},
        {close: 19, high: 20, low: 13},
        {close: 16, high: 18, low: 15},
        {close: 15, high: 17, low: 14},
        {close: 14, high: 16, low: 13},
        {close: 13, high: 15, low: 12},
      ] as const;
      const cks = new ChandeKrollStop({interval: 3, multiplier: 2, stopInterval: 3});

      for (const candle of spikeCandles) {
        cks.add(candle);
      }

      /*
       * The spike high of 20 left the extreme window two bars ago and every newer preliminary short
       * stop sits lower, yet the reported short stop stays pinned at the level established while the
       * spike still counted — the second pass keeps one noisy bar from loosening the protection.
       */
      expect(cks.getResultOrThrow()).toEqual({
        longStop: 18.46090534979424,
        shortStop: 12.962962962962962,
      });
    });

    it('uses an interval of 10, a multiplier of 1 and a stop interval of 9 by default', () => {
      const cks = new ChandeKrollStop();

      expect(cks.getRequiredInputs()).toBe(18);
      expect(cks.interval).toBe(10);
      expect(cks.multiplier).toBe(1);
      expect(cks.stopInterval).toBe(9);
    });
  });
});

testIndicatorContract({
  create: () => new ChandeKrollStop({interval: 5, multiplier: 2, stopInterval: 3}),
  divergentInput: {close: 500, high: 510, low: 490},
  inputs: [
    {close: 81.59, high: 82.15, low: 81.29},
    {close: 81.06, high: 81.89, low: 80.64},
    {close: 82.87, high: 83.03, low: 81.31},
    {close: 83.0, high: 83.3, low: 82.65},
    {close: 83.61, high: 83.85, low: 83.07},
    {close: 83.15, high: 83.9, low: 83.11},
    {close: 82.84, high: 83.33, low: 82.49},
    {close: 83.99, high: 84.3, low: 82.3},
  ],
});
