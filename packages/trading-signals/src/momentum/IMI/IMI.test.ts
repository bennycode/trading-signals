import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {TradingSignal} from '../../base/Indicator.js';
import {IMI} from './IMI.js';

describe('IMI', () => {
  /*
   * Hand-derived worksheet (interval 5). Candle bodies (close minus open):
   * +2, -1, +4, 0, -1, -2, +3, -4
   *
   * Window [+2, -1, +4,  0, -1]: gains 6, losses 2 → 100 × 6 / 8  = 75
   * Window [-1, +4,  0, -1, -2]: gains 4, losses 4 → 100 × 4 / 8  = 50
   * Window [+4,  0, -1, -2, +3]: gains 7, losses 3 → 100 × 7 / 10 = 70
   * Window [ 0, -1, -2, +3, -4]: gains 3, losses 7 → 100 × 3 / 10 = 30
   */
  const candles = [
    {close: 102, high: 103, low: 99, open: 100},
    {close: 101, high: 103, low: 100, open: 102},
    {close: 105, high: 106, low: 100, open: 101},
    {close: 105, high: 106, low: 104, open: 105},
    {close: 104, high: 106, low: 103, open: 105},
    {close: 102, high: 105, low: 101, open: 104},
    {close: 105, high: 106, low: 101, open: 102},
    {close: 101, high: 106, low: 100, open: 105},
  ] as const;
  const expectations = [75, 50, 70, 30] as const;

  describe('constructor', () => {
    it('rejects a window length that cannot form a real buffer', () => {
      expect(() => new IMI(0)).toThrowError('The interval has to be a positive number, but "0" was given.');
      expect(() => new IMI(Number.NaN)).toThrowError('The interval has to be a positive number, but "NaN" was given.');
    });

    it('defaults to the interval of 14 suggested by Tushar Chande and Stanley Kroll', () => {
      const imi = new IMI();

      expect(imi.getRequiredInputs()).toBe(14);
    });
  });

  describe('getResultOrThrow', () => {
    it('weighs the candle body gains against the losses over the sliding window', () => {
      const imi = new IMI(5);
      const offset = imi.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = imi.add(candle);

        if (i < offset) {
          expect(result).toBeNull();
        } else {
          expect(result).toBe(expectations[i - offset]);
        }
      });

      expect(imi.isStable).toBe(true);
    });

    it('reports full buying pressure when every candle in the window closes above its open', () => {
      const imi = new IMI(5);

      for (let i = 0; i < 5; i++) {
        imi.add({close: 102 + i, high: 103 + i, low: 99 + i, open: 100 + i});
      }

      expect(imi.getResultOrThrow()).toBe(100);
    });

    it('reports full selling pressure when every candle in the window closes below its open', () => {
      const imi = new IMI(5);

      for (let i = 0; i < 5; i++) {
        imi.add({close: 98 - i, high: 101 - i, low: 97 - i, open: 100 - i});
      }

      expect(imi.getResultOrThrow()).toBe(0);
    });

    it('returns a neutral index when every candle in the window is a doji', () => {
      const imi = new IMI(5);
      const doji = {close: 50, high: 51, low: 49, open: 50} as const;

      for (let i = 0; i < 5; i++) {
        imi.add(doji);
      }

      expect(imi.getResultOrThrow()).toBe(50);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const imi = new IMI(5);

      for (const candle of candles) {
        imi.add(candle);
      }

      // Window bodies [-1, -2, +3, -4, +4]: gains 7, losses 7 → 50
      const originalValue = {close: 105, high: 106, low: 100, open: 101} as const;
      // Window bodies [-1, -2, +3, -4, +10]: gains 13, losses 7 → 65
      const replacedValue = {close: 111, high: 112, low: 100, open: 101} as const;

      const originalResult = imi.add(originalValue);

      expect(originalResult).toBe(50);

      const replacedResult = imi.replace(replacedValue);

      expect(replacedResult).toBe(65);

      const restoredResult = imi.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the window is filled', () => {
      const imi = new IMI(5);

      expect(imi.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when the IMI sits exactly on the overbought threshold', () => {
      const imi = new IMI(5);

      for (const candle of candles.slice(0, 7)) {
        imi.add(candle);
      }

      expect(imi.getResultOrThrow()).toBe(70);
      expect(imi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the IMI sits exactly on the oversold threshold', () => {
      const imi = new IMI(5);

      for (const candle of candles) {
        imi.add(candle);
      }

      expect(imi.getResultOrThrow()).toBe(30);
      expect(imi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when buyers and sellers are balanced', () => {
      const imi = new IMI(5);

      for (const candle of candles.slice(0, 6)) {
        imi.add(candle);
      }

      expect(imi.getResultOrThrow()).toBe(50);
      expect(imi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const strictImi = new IMI(5, {overbought: 80});
      const looseImi = new IMI(5, {oversold: 55});

      for (const candle of candles.slice(0, 5)) {
        strictImi.add(candle);
      }

      expect(strictImi.getResultOrThrow()).toBe(75);
      expect(strictImi.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      for (const candle of candles.slice(0, 6)) {
        looseImi.add(candle);
      }

      expect(looseImi.getResultOrThrow()).toBe(50);
      expect(looseImi.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});

testIndicatorContract({
  create: () => new IMI(5),
  divergentInput: {close: 500, high: 500, low: 100, open: 100},
  inputs: [
    {close: 102, high: 103, low: 99, open: 100},
    {close: 101, high: 103, low: 100, open: 102},
    {close: 105, high: 106, low: 100, open: 101},
    {close: 105, high: 106, low: 104, open: 105},
    {close: 104, high: 106, low: 103, open: 105},
    {close: 102, high: 105, low: 101, open: 104},
    {close: 105, high: 106, low: 101, open: 102},
  ],
});
