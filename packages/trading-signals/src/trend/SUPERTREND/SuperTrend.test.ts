import {SuperTrend} from './SuperTrend.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('SuperTrend', () => {
  /*
   * Expected values computed with an independent throwaway Node.js script implementing the
   * TradingView formula (hl2 ± multiplier × ATR basic bands, ratcheting final bands,
   * close-through-band trend flips, Wilder's ATR):
   * https://www.tradingview.com/support/solutions/43000634738-supertrend/
   *
   * The sequence covers an uptrend breakout (flip to BULLISH), a crash (flip to BEARISH),
   * a grind lower (upper band ratcheting down) and a rally (second flip to BULLISH).
   */
  const candles = [
    {close: 81, high: 82, low: 80},
    {close: 82, high: 83, low: 81},
    {close: 83, high: 84, low: 82},
    {close: 84, high: 85, low: 83},
    {close: 85, high: 86, low: 84},
    {close: 86, high: 87, low: 85},
    {close: 87, high: 88, low: 86},
    {close: 90.5, high: 91, low: 87},
    {close: 91, high: 92, low: 89},
    {close: 92, high: 93, low: 90},
    {close: 82, high: 92, low: 81},
    {close: 77, high: 83, low: 76},
    {close: 75, high: 78, low: 74},
    {close: 74, high: 76, low: 73},
    {close: 73, high: 75, low: 72},
    {close: 79, high: 80, low: 72},
    {close: 85.5, high: 86, low: 79},
    {close: 86, high: 87, low: 84},
    {close: 87, high: 88, low: 85},
    {close: 88, high: 89, low: 86},
  ] as const;
  const expectations = [
    ['89.0000', 'BEARISH'],
    ['89.0000', 'BEARISH'],
    ['89.0000', 'BEARISH'],
    ['84.2000', 'BULLISH'],
    ['85.4600', 'BULLISH'],
    ['86.2680', 'BULLISH'],
    ['95.0856', 'BEARISH'],
    ['89.1685', 'BEARISH'],
    ['85.3348', 'BEARISH'],
    ['83.1678', 'BEARISH'],
    ['81.6343', 'BEARISH'],
    ['81.6343', 'BEARISH'],
    ['71.9341', 'BULLISH'],
    ['75.8473', 'BULLISH'],
    ['77.5778', 'BULLISH'],
    ['79.1622', 'BULLISH'],
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const supertrend = new SuperTrend({interval: 5, multiplier: 2});

      supertrend.updates(candles, false);

      const originalValue = {close: 88, high: 89, low: 86} as const;
      const replacedValue = {close: 61, high: 87, low: 60} as const;

      const originalResult = supertrend.add(originalValue);

      expect(originalResult?.supertrend.toFixed(4)).toBe('79.6298');
      expect(originalResult?.trend).toBe('BULLISH');

      const replacedResult = supertrend.replace(replacedValue);

      expect(replacedResult?.supertrend.toFixed(4)).toBe('91.3702');
      expect(replacedResult?.trend).toBe('BEARISH');

      const restoredResult = supertrend.replace(originalValue);

      expect(restoredResult).toEqual(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('rides the active band and flips the trend when the close breaks through it', () => {
      const supertrend = new SuperTrend({interval: 5, multiplier: 2});
      const offset = supertrend.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = supertrend.add(candle);

        if (result) {
          const [expectedValue, expectedTrend] = expectations[i - offset];
          expect(result.supertrend.toFixed(4)).toBe(expectedValue);
          expect(result.trend).toBe(expectedTrend);
        }
      });

      expect(supertrend.isStable).toBe(true);
      expect(supertrend.getRequiredInputs()).toBe(5);
    });

    it('uses an interval of 10 and a multiplier of 3 by default', () => {
      const supertrend = new SuperTrend();

      expect(supertrend.getRequiredInputs()).toBe(10);
      expect(supertrend.multiplier).toBe(3);
    });

    it('starts in an uptrend when the first stable close clears the upper band', () => {
      const supertrend = new SuperTrend({interval: 2, multiplier: 0.5});

      supertrend.add({close: 10, high: 11, low: 9});

      const result = supertrend.add({close: 15, high: 15.1, low: 9});

      expect(result?.supertrend.toFixed(3)).toBe('10.025');
      expect(result?.trend).toBe('BULLISH');
    });

    it('throws an error when there is not enough input data', () => {
      const supertrend = new SuperTrend({interval: 5, multiplier: 2});

      try {
        supertrend.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
