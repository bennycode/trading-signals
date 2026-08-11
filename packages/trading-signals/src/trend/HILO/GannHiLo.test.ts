import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {GannHiLo} from './GannHiLo.js';
import {TradingSignal} from '../../base/index.js';

describe('GannHiLo', () => {
  describe('update', () => {
    it('follows the average of the lows in an uptrend, freezes between the averages, and jumps to the average of the highs on a downside break', () => {
      /*
       * Formula (Robert Krausz, "A W.D. Gann Treasure Discovered"; pandas-ta-classic hilo.py):
       * close > SMA(high, hi)[prev] -> line = SMA(low, lo), trend up
       * close < SMA(low, lo)[prev]  -> line = SMA(high, hi), trend down
       * otherwise                   -> line freezes, trend persists
       * https://github.com/xgboosted/pandas-ta-classic/blob/main/pandas_ta_classic/overlap/hilo.py
       *
       * The expectations below are derived by hand with highInterval 3 and lowInterval 5:
       *
       * | Bar | High | Low | Close | SMA3(high) | SMA5(low) | Breakout          | Line          | Trend   |
       * |-----|------|-----|-------|------------|-----------|-------------------|---------------|---------|
       * | 1   | 12   | 8   | 10    | -          | -         | -                 | -             | -       |
       * | 2   | 13   | 9   | 11    | -          | -         | -                 | -             | -       |
       * | 3   | 14   | 10  | 12    | 13         | -         | -                 | -             | -       |
       * | 4   | 15   | 11  | 14    | 14         | -         | 14 > 13, up       | - (no SMA5)   | -       |
       * | 5   | 16   | 12  | 15    | 15         | 10        | 15 > 14, up       | 10            | BULLISH |
       * | 6   | 17   | 13  | 16    | 16         | 11        | 16 > 15, up       | 11            | BULLISH |
       * | 7   | 16   | 12  | 14    | 49/3       | 11.6      | none, freeze      | 11            | BULLISH |
       * | 8   | 13   | 9   | 10    | 46/3       | 11.4      | 10 < 11.6, down   | 46/3 = 15.33  | BEARISH |
       * | 9   | 12   | 8   | 9     | 41/3       | 10.8      | 9 < 11.4, down    | 41/3 = 13.67  | BEARISH |
       * | 10  | 13   | 10  | 12    | 38/3       | 10.4      | none, freeze      | 41/3 = 13.67  | BEARISH |
       * | 11  | 15   | 12  | 14    | 40/3       | 10.2      | 14 > 38/3, up     | 10.2          | BULLISH |
       * | 12  | 16   | 13  | 15    | 44/3       | 10.4      | 15 > 40/3, up     | 10.4          | BULLISH |
       */
      const candles = [
        {close: 10, high: 12, low: 8},
        {close: 11, high: 13, low: 9},
        {close: 12, high: 14, low: 10},
        {close: 14, high: 15, low: 11},
        {close: 15, high: 16, low: 12},
        {close: 16, high: 17, low: 13},
        {close: 14, high: 16, low: 12},
        {close: 10, high: 13, low: 9},
        {close: 9, high: 12, low: 8},
        {close: 12, high: 13, low: 10},
        {close: 14, high: 15, low: 12},
        {close: 15, high: 16, low: 13},
      ] as const;
      const expectations = [
        {line: '10.00', trend: TradingSignal.BULLISH},
        {line: '11.00', trend: TradingSignal.BULLISH},
        {line: '11.00', trend: TradingSignal.BULLISH},
        {line: '15.33', trend: TradingSignal.BEARISH},
        {line: '13.67', trend: TradingSignal.BEARISH},
        {line: '13.67', trend: TradingSignal.BEARISH},
        {line: '10.20', trend: TradingSignal.BULLISH},
        {line: '10.40', trend: TradingSignal.BULLISH},
      ] as const;
      const hilo = new GannHiLo({highInterval: 3, lowInterval: 5});
      const offset = hilo.getRequiredInputs() - 1;
      let verifiedBars = 0;

      candles.forEach((candle, i) => {
        const result = hilo.add(candle);

        if (result) {
          verifiedBars++;
          const expected = expectations[i - offset];
          expect(result.line.toFixed(2)).toBe(expected.line);
          expect(result.trend).toBe(expected.trend);
        }
      });

      expect(verifiedBars).toBe(expectations.length);
      expect(hilo.isStable).toBe(true);
    });

    it('plots nothing when price breaks out before the average of the lows has formed', () => {
      /*
       * With a short high interval, the close can clear the average of the highs while the average
       * of the lows still lacks candles. The reference implementation leaves those bars empty, so
       * the first line only appears once the activated average can name a level.
       */
      const warmUpCandles = [
        {close: 8, high: 10, low: 6},
        {close: 9, high: 11, low: 7},
        {close: 12, high: 13, low: 9},
        {close: 10, high: 12, low: 8},
      ] as const;
      const hilo = new GannHiLo({highInterval: 2, lowInterval: 5});

      for (const candle of warmUpCandles) {
        expect(hilo.add(candle)).toBeNull();
      }

      expect(hilo.add({close: 13, high: 13, low: 9})).toEqual({line: 7.8, trend: TradingSignal.BULLISH});
    });

    it('plots nothing when price breaks down before the average of the highs has formed', () => {
      const warmUpCandles = [
        {close: 18, high: 20, low: 16},
        {close: 17, high: 19, low: 15},
        {close: 12, high: 18, low: 10},
        {close: 10, high: 14, low: 9},
      ] as const;
      const hilo = new GannHiLo({highInterval: 5, lowInterval: 2});

      for (const candle of warmUpCandles) {
        expect(hilo.add(candle)).toBeNull();
      }

      expect(hilo.add({close: 9, high: 13, low: 8})).toEqual({line: 16.8, trend: TradingSignal.BEARISH});
    });

    it('gives the upside breakout precedence when a candle clears both averages at once', () => {
      /*
       * After a crash, the long average of the lows still carries the old price level while the
       * short average of the highs already reflects the sell-off, so a recovery candle can close
       * above the highs average and below the lows average at the same time. The upside rule wins,
       * matching the reference implementation.
       */
      const candles = [
        {close: 95, high: 100, low: 90},
        {close: 90, high: 98, low: 88},
        {close: 35, high: 40, low: 30},
        {close: 36, high: 38, low: 28},
        {close: 45, high: 50, low: 40},
      ] as const;
      const hilo = new GannHiLo({highInterval: 2, lowInterval: 4});

      for (const candle of candles) {
        hilo.add(candle);
      }

      expect(hilo.getResultOrThrow()).toEqual({line: 46.5, trend: TradingSignal.BULLISH});
    });

    it('does not flip up when the close only touches the average of the highs', () => {
      const hilo = new GannHiLo({highInterval: 2, lowInterval: 2});

      hilo.add({close: 9, high: 10, low: 8});
      hilo.add({close: 11, high: 12, low: 9});

      // The average of the highs sits exactly at the close, so there is no breakout
      expect(hilo.add({close: 11, high: 12, low: 10})).toBeNull();

      expect(hilo.add({close: 13, high: 13, low: 11})).toEqual({line: 10.5, trend: TradingSignal.BULLISH});
    });

    it('does not flip down when the close only touches the average of the lows', () => {
      const hilo = new GannHiLo({highInterval: 2, lowInterval: 2});

      hilo.add({close: 9, high: 10, low: 8});
      hilo.add({close: 8, high: 10, low: 7});

      // The average of the lows sits exactly at the close, so there is no breakdown
      expect(hilo.add({close: 7.5, high: 9, low: 7})).toBeNull();

      expect(hilo.add({close: 6, high: 8, low: 5})).toEqual({line: 8.5, trend: TradingSignal.BEARISH});
    });
  });

  describe('getRequiredInputs', () => {
    it('defaults to the intervals popularized by pandas-ta: 13 highs and 21 lows', () => {
      const hilo = new GannHiLo();

      expect(hilo.highInterval).toBe(13);
      expect(hilo.lowInterval).toBe(21);
      expect(hilo.getRequiredInputs()).toBe(21);
    });

    it('lets the longer interval dominate the warm-up and adds the breakout candle when both intervals match', () => {
      expect(new GannHiLo({highInterval: 3, lowInterval: 5}).getRequiredInputs()).toBe(5);
      expect(new GannHiLo({highInterval: 5, lowInterval: 2}).getRequiredInputs()).toBe(5);
      expect(new GannHiLo({highInterval: 2, lowInterval: 2}).getRequiredInputs()).toBe(3);
    });
  });

  describe('replace', () => {
    it('rewinds an upside flip when the replacement candle breaks down instead', () => {
      const candles = [
        {close: 10, high: 12, low: 8},
        {close: 11, high: 13, low: 9},
        {close: 12, high: 14, low: 10},
        {close: 14, high: 15, low: 11},
        {close: 15, high: 16, low: 12},
        {close: 16, high: 17, low: 13},
        {close: 14, high: 16, low: 12},
        {close: 10, high: 13, low: 9},
        {close: 9, high: 12, low: 8},
        {close: 12, high: 13, low: 10},
      ] as const;
      const hilo = new GannHiLo({highInterval: 3, lowInterval: 5});

      for (const candle of candles) {
        hilo.add(candle);
      }

      const originalCandle = {close: 14, high: 15, low: 12} as const;
      const replacementCandle = {close: 8, high: 12, low: 9} as const;

      const originalResult = hilo.add(originalCandle);

      expect(originalResult?.line.toFixed(2)).toBe('10.20');
      expect(originalResult?.trend).toBe(TradingSignal.BULLISH);

      const replacedResult = hilo.replace(replacementCandle);

      expect(replacedResult?.line.toFixed(2)).toBe('12.33');
      expect(replacedResult?.trend).toBe(TradingSignal.BEARISH);

      const restoredResult = hilo.replace(originalCandle);

      expect(restoredResult?.line.toFixed(2)).toBe('10.20');
      expect(restoredResult?.trend).toBe(TradingSignal.BULLISH);
    });

    it('rewinds a downside flip when the replacement candle breaks out instead', () => {
      const candles = [
        {close: 10, high: 12, low: 8},
        {close: 11, high: 13, low: 9},
        {close: 12, high: 14, low: 10},
        {close: 14, high: 15, low: 11},
        {close: 15, high: 16, low: 12},
        {close: 16, high: 17, low: 13},
        {close: 14, high: 16, low: 12},
      ] as const;
      const hilo = new GannHiLo({highInterval: 3, lowInterval: 5});

      for (const candle of candles) {
        hilo.add(candle);
      }

      const originalCandle = {close: 10, high: 13, low: 9} as const;
      const replacementCandle = {close: 17, high: 18, low: 13} as const;

      const originalResult = hilo.add(originalCandle);

      expect(originalResult?.line.toFixed(2)).toBe('15.33');
      expect(originalResult?.trend).toBe(TradingSignal.BEARISH);

      const replacedResult = hilo.replace(replacementCandle);

      expect(replacedResult?.line.toFixed(2)).toBe('12.20');
      expect(replacedResult?.trend).toBe(TradingSignal.BULLISH);

      const restoredResult = hilo.replace(originalCandle);

      expect(restoredResult?.line.toFixed(2)).toBe('15.33');
      expect(restoredResult?.trend).toBe(TradingSignal.BEARISH);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const hilo = new GannHiLo({highInterval: 3, lowInterval: 5});

      expect(hilo.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});

      hilo.add({close: 10, high: 12, low: 8});
      hilo.add({close: 11, high: 13, low: 9});

      expect(hilo.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH once the line supports price from below', () => {
      const hilo = new GannHiLo({highInterval: 2, lowInterval: 2});

      hilo.add({close: 9, high: 10, low: 8});
      hilo.add({close: 11, high: 12, low: 9});
      hilo.add({close: 12, high: 13, low: 10});

      expect(hilo.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});
    });

    it('returns BEARISH once the line caps price from above', () => {
      const hilo = new GannHiLo({highInterval: 2, lowInterval: 2});

      hilo.add({close: 12, high: 13, low: 10});
      hilo.add({close: 11, high: 12, low: 9});
      hilo.add({close: 8, high: 10, low: 7});

      expect(hilo.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BEARISH});
    });

    it('flags a change only when the trend flips sides', () => {
      const hilo = new GannHiLo({highInterval: 3, lowInterval: 5});

      hilo.add({close: 10, high: 12, low: 8});
      hilo.add({close: 11, high: 13, low: 9});
      hilo.add({close: 12, high: 14, low: 10});
      hilo.add({close: 14, high: 15, low: 11});
      hilo.add({close: 15, high: 16, low: 12});

      expect(hilo.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});

      hilo.add({close: 16, high: 17, low: 13});

      expect(hilo.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});

      // The close holds between both averages, so the frozen line keeps the bullish signal
      hilo.add({close: 14, high: 16, low: 12});

      expect(hilo.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});

      hilo.add({close: 10, high: 13, low: 9});

      expect(hilo.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BEARISH});
    });
  });
});

testIndicatorContract({
  create: () => new GannHiLo({highInterval: 3, lowInterval: 5}),
  divergentInput: {close: 1_000, high: 1_010, low: 990},
  inputs: [
    {close: 10, high: 12, low: 8},
    {close: 11, high: 13, low: 9},
    {close: 12, high: 14, low: 10},
    {close: 14, high: 15, low: 11},
    {close: 15, high: 16, low: 12},
    {close: 16, high: 17, low: 13},
    {close: 14, high: 16, low: 12},
    {close: 10, high: 13, low: 9},
    {close: 9, high: 12, low: 8},
    {close: 12, high: 13, low: 10},
    {close: 14, high: 15, low: 12},
    {close: 15, high: 16, low: 13},
  ],
});
