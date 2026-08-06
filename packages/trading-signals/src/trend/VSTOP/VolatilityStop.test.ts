import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {VolatilityStop} from './VolatilityStop.js';

describe('VolatilityStop', () => {
  /*
   * Expected values computed with an independent throwaway Node.js script implementing Vervoort's published logic
   * directly (loss = multiplier × Wilder ATR(interval); stop ratchets via max/min while both the current and the
   * previous close stay on the trend's side, flips to close ∓ loss otherwise; first stable bar = close − loss):
   * https://traders.com/Documentation/FEEDbk_docs/2009/06/Vervoort.html
   * https://traders.com/Documentation/FEEDbk_docs/2009/06/TradersTips.html
   *
   * The sequence exercises every branch: initialization (bar 5), uptrend ratchet moving up (bar 6), uptrend ratchet
   * holding (bar 7), flip to downtrend (bar 8), downtrend ratchet moving down (bar 9), downtrend ratchet holding
   * (bar 10), flip back to uptrend (bar 11) and another uptrend ratchet (bar 12).
   */
  const candles = [
    {close: 10, high: 11, low: 9},
    {close: 11, high: 12, low: 10},
    {close: 12, high: 13, low: 11},
    {close: 13, high: 14, low: 12},
    {close: 14, high: 15, low: 13},
    {close: 15, high: 16, low: 14},
    {close: 14.5, high: 15.5, low: 13.5},
    {close: 10, high: 15, low: 9.5},
    {close: 9, high: 10, low: 8},
    {close: 9.5, high: 10.5, low: 8.5},
    {close: 13, high: 13.5, low: 9},
    {close: 14, high: 15, low: 13},
  ] as const;
  const expectedStops = [
    '12.0000',
    '13.0000',
    '13.0000',
    '12.7000',
    '11.5600',
    '11.5600',
    '10.1416',
    '11.3133',
  ] as const;
  const expectedSignals = [
    'BULLISH',
    'BULLISH',
    'BULLISH',
    'BEARISH',
    'BEARISH',
    'BEARISH',
    'BULLISH',
    'BULLISH',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value and flips the side back and forth', () => {
      const vstop = new VolatilityStop({interval: 5, multiplier: 1});

      vstop.updates(candles, false);

      const originalValue = {close: 15, high: 16, low: 14} as const;
      const replacedValue = {close: 8, high: 14.5, low: 7.5} as const;

      const originalResult = vstop.add(originalValue);

      expect(originalResult?.stop.toFixed(4)).toBe('12.4506');
      expect(originalResult?.signal).toBe('BULLISH');

      const replacedResult = vstop.replace(replacedValue);

      expect(replacedResult?.stop.toFixed(4)).toBe('11.5494');
      expect(replacedResult?.signal).toBe('BEARISH');

      const restoredResult = vstop.replace(originalValue);

      expect(restoredResult).toEqual(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('ratchets the stop in the trade direction and flips the side when the close breaches it', () => {
      const vstop = new VolatilityStop({interval: 5, multiplier: 1});
      const offset = vstop.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = vstop.add(candle);

        if (result) {
          expect(result.stop.toFixed(4)).toBe(expectedStops[i - offset]);
          expect(result.signal).toBe(expectedSignals[i - offset]);
        }
      });

      expect(vstop.isStable).toBe(true);
    });

    it('uses an interval of 5 and a multiplier of 3.5 by default', () => {
      const vstop = new VolatilityStop();

      expect(vstop.getRequiredInputs()).toBe(5);
      expect(vstop.multiplier).toBe(3.5);
    });
  });
});

testIndicatorContract({
  create: () => new VolatilityStop({interval: 5, multiplier: 1}),
  divergentInput: {close: 1, high: 14, low: 0.5},
  inputs: [
    {close: 10, high: 11, low: 9},
    {close: 11, high: 12, low: 10},
    {close: 12, high: 13, low: 11},
    {close: 13, high: 14, low: 12},
    {close: 14, high: 15, low: 13},
    {close: 15, high: 16, low: 14},
    {close: 14.5, high: 15.5, low: 13.5},
    {close: 10, high: 15, low: 9.5},
    {close: 9, high: 10, low: 8},
    {close: 9.5, high: 10.5, low: 8.5},
    {close: 13, high: 13.5, low: 9},
    {close: 14, high: 15, low: 13},
  ],
});
