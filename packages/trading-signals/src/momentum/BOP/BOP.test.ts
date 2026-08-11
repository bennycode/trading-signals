import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {TradingSignal} from '../../base/Indicator.js';
import {BOP} from './BOP.js';

describe('BOP', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L92-L97
   */
  const candles = [
    {close: 81.59, high: 82.15, low: 81.29, open: 81.85},
    {close: 81.06, high: 81.89, low: 80.64, open: 81.2},
    {close: 82.87, high: 83.03, low: 81.31, open: 81.55},
    {close: 83.0, high: 83.3, low: 82.65, open: 82.91},
    {close: 83.61, high: 83.85, low: 83.07, open: 83.1},
    {close: 83.15, high: 83.9, low: 83.11, open: 83.41},
    {close: 82.84, high: 83.33, low: 82.49, open: 82.71},
    {close: 83.99, high: 84.3, low: 82.3, open: 82.7},
    {close: 84.55, high: 84.84, low: 84.15, open: 84.2},
    {close: 84.36, high: 85.0, low: 84.11, open: 84.25},
    {close: 85.53, high: 85.9, low: 84.03, open: 84.03},
    {close: 86.54, high: 86.58, low: 85.39, open: 85.45},
    {close: 86.89, high: 86.98, low: 85.76, open: 86.18},
    {close: 87.77, high: 88.0, low: 87.17, open: 88.0},
    {close: 87.29, high: 87.87, low: 87.01, open: 87.6},
  ] as const;
  const expectations = [
    '-0.302',
    '-0.112',
    '0.767',
    '0.138',
    '0.654',
    '-0.329',
    '0.155',
    '0.645',
    '0.507',
    '0.124',
    '0.802',
    '0.916',
    '0.582',
    '-0.277',
    '-0.360',
  ] as const;

  describe('getResultOrThrow', () => {
    it('calculates the balance of power from the very first candle', {tags: ['tulipindicators']}, () => {
      const bop = new BOP();

      expect(bop.getRequiredInputs()).toBe(1);

      candles.forEach((candle, i) => {
        const result = bop.add(candle);
        expect(result?.toFixed(3)).toBe(expectations[i]);
      });

      expect(bop.isStable).toBe(true);
    });

    it('reads a candle without any range as perfectly balanced', () => {
      const bop = new BOP();

      const result = bop.add({close: 100, high: 100, low: 100, open: 100});

      expect(result).toBe(0);
      expect(bop.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const bop = new BOP();

      for (const candle of candles) {
        bop.add(candle);
      }

      const originalValue = {close: 15, high: 20, low: 10, open: 10} as const;
      const replacedValue = {close: 11, high: 20, low: 10, open: 19} as const;

      bop.add(originalValue);

      expect(bop.getResultOrThrow()).toBe(0.5);

      bop.replace(replacedValue);

      expect(bop.getResultOrThrow()).toBe(-0.8);

      bop.replace(originalValue);

      expect(bop.getResultOrThrow()).toBe(0.5);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before any candle was added', () => {
      const bop = new BOP();

      expect(bop.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when buyers close the candle above its open', () => {
      const bop = new BOP();

      bop.add({close: 15, high: 20, low: 10, open: 12});

      expect(bop.getResultOrThrow()).toBeGreaterThan(0);
      expect(bop.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BULLISH,
      });
    });

    it('returns BEARISH when sellers close the candle below its open', () => {
      const bop = new BOP();

      bop.add({close: 11, high: 20, low: 10, open: 19});

      expect(bop.getResultOrThrow()).toBeLessThan(0);
      expect(bop.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });

    it('returns SIDEWAYS for a doji closing exactly where it opened', () => {
      const bop = new BOP();

      bop.add({close: 12, high: 14, low: 10, open: 12});

      expect(bop.getResultOrThrow()).toBe(0);
      expect(bop.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.SIDEWAYS,
      });
    });

    it('keeps the signal unchanged while the same side stays in control', () => {
      const bop = new BOP();

      bop.add({close: 15, high: 20, low: 10, open: 12});
      bop.add({close: 18, high: 20, low: 10, open: 11});

      expect(bop.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BULLISH,
      });
    });

    it('flags the change when control flips from buyers to sellers', () => {
      const bop = new BOP();

      bop.add({close: 15, high: 20, low: 10, open: 12});
      bop.add({close: 11, high: 20, low: 10, open: 19});

      expect(bop.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });
  });
});

testIndicatorContract({
  create: () => new BOP(),
  divergentInput: {close: 900, high: 1_000, low: 800, open: 950},
  inputs: [
    {close: 81.59, high: 82.15, low: 81.29, open: 81.85},
    {close: 81.06, high: 81.89, low: 80.64, open: 81.2},
    {close: 82.87, high: 83.03, low: 81.31, open: 81.55},
    {close: 83.0, high: 83.3, low: 82.65, open: 82.91},
    {close: 83.61, high: 83.85, low: 83.07, open: 83.1},
    {close: 83.15, high: 83.9, low: 83.11, open: 83.41},
  ],
});
