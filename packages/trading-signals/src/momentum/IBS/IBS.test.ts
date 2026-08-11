import {TradingSignal} from '../../base/Indicator.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {IBS} from './IBS.js';

describe('IBS', () => {
  /*
   * The candles reuse the Tulip Indicators BOP test data (without the open):
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L92-L97
   *
   * The expectations are hand-derived by locating the close within each candle's range,
   * e.g. for the first candle: (81.59 - 81.29) / (82.15 - 81.29) = 0.30 / 0.86 ≈ 0.349.
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
  const expectations = [
    '0.349',
    '0.336',
    '0.907',
    '0.538',
    '0.692',
    '0.051',
    '0.417',
    '0.845',
    '0.580',
    '0.281',
    '0.802',
    '0.966',
    '0.926',
    '0.723',
    '0.326',
  ] as const;

  describe('getResultOrThrow', () => {
    it('locates the close within its candle range from the very first candle', () => {
      const ibs = new IBS();

      expect(ibs.getRequiredInputs()).toBe(1);

      candles.forEach((candle, i) => {
        const result = ibs.add(candle);
        expect(result?.toFixed(3)).toBe(expectations[i]);
      });

      expect(ibs.isStable).toBe(true);
    });

    it('reads a candle without any range as the neutral midpoint', () => {
      const ibs = new IBS();

      const result = ibs.add({close: 100, high: 100, low: 100});

      expect(result).toBe(0.5);
      expect(ibs.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const ibs = new IBS();

      for (const candle of candles) {
        ibs.add(candle);
      }

      const originalValue = {close: 18, high: 20, low: 10} as const;
      const replacedValue = {close: 11, high: 20, low: 10} as const;

      ibs.add(originalValue);

      expect(ibs.getResultOrThrow()).toBe(0.8);

      ibs.replace(replacedValue);

      expect(ibs.getResultOrThrow()).toBe(0.1);

      ibs.replace(originalValue);

      expect(ibs.getResultOrThrow()).toBe(0.8);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before any candle was added', () => {
      const ibs = new IBS();

      expect(ibs.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when buyers pin the close to the top of the range', () => {
      const ibs = new IBS();

      ibs.add({close: 19, high: 20, low: 10});

      expect(ibs.getResultOrThrow()).toBe(0.9);
      expect(ibs.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BULLISH,
      });
    });

    it('returns BULLISH when the close sits exactly on the overbought threshold', () => {
      const ibs = new IBS();

      ibs.add({close: 18, high: 20, low: 10});

      expect(ibs.getResultOrThrow()).toBe(0.8);
      expect(ibs.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when sellers pin the close to the bottom of the range', () => {
      const ibs = new IBS();

      ibs.add({close: 11, high: 20, low: 10});

      expect(ibs.getResultOrThrow()).toBe(0.1);
      expect(ibs.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });

    it('returns BEARISH when the close sits exactly on the oversold threshold', () => {
      const ibs = new IBS();

      ibs.add({close: 12, high: 20, low: 10});

      expect(ibs.getResultOrThrow()).toBe(0.2);
      expect(ibs.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the close sits between the thresholds', () => {
      const ibs = new IBS();

      ibs.add({close: 15, high: 20, low: 10});

      expect(ibs.getResultOrThrow()).toBe(0.5);
      expect(ibs.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.SIDEWAYS,
      });
    });

    it('respects custom overbought and oversold thresholds', () => {
      const strictIbs = new IBS({overbought: 0.95});
      const looseIbs = new IBS({oversold: 0.45});

      strictIbs.add({close: 19, high: 20, low: 10});

      expect(strictIbs.getResultOrThrow()).toBe(0.9);
      expect(strictIbs.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      looseIbs.add({close: 14, high: 20, low: 10});

      expect(looseIbs.getResultOrThrow()).toBe(0.4);
      expect(looseIbs.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('keeps the signal unchanged while the close stays pinned to the same extreme', () => {
      const ibs = new IBS();

      ibs.add({close: 19, high: 20, low: 10});
      ibs.add({close: 18, high: 20, low: 10});

      expect(ibs.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BULLISH,
      });
    });

    it('flags the change when the close flips from the top to the bottom of the range', () => {
      const ibs = new IBS();

      ibs.add({close: 19, high: 20, low: 10});
      ibs.add({close: 11, high: 20, low: 10});

      expect(ibs.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });
  });
});

testIndicatorContract({
  create: () => new IBS(),
  divergentInput: {close: 990, high: 1_000, low: 800},
  inputs: [
    {close: 81.59, high: 82.15, low: 81.29},
    {close: 81.06, high: 81.89, low: 80.64},
    {close: 82.87, high: 83.03, low: 81.31},
    {close: 83.0, high: 83.3, low: 82.65},
    {close: 83.61, high: 83.85, low: 83.07},
    {close: 83.15, high: 83.9, low: 83.11},
  ],
});
