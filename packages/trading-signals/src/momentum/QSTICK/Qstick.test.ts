import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {TradingSignal} from '../../base/Indicator.js';
import {Qstick} from './Qstick.js';

describe('Qstick', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L327-L330
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
    '0.304',
    '0.304',
    '0.358',
    '0.352',
    '0.404',
    '0.324',
    '0.676',
    '0.868',
    '0.752',
    '0.636',
    '0.552',
  ] as const;

  describe('constructor', () => {
    it('defaults to the interval of 8 suggested by Tushar Chande', () => {
      const qstick = new Qstick();

      expect(qstick.getRequiredInputs()).toBe(8);
    });
  });

  describe('getResultOrThrow', () => {
    it('averages the candle bodies over the interval', {tags: ['tulipindicators']}, () => {
      const qstick = new Qstick(5);
      const offset = qstick.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = qstick.add(candle);

        if (i < offset) {
          expect(result).toBeNull();
        } else {
          expect(result?.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(qstick.isStable).toBe(true);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const qstick = new Qstick(3);

      qstick.add({close: 11, high: 12, low: 9, open: 10});
      qstick.add({close: 12, high: 13, low: 9, open: 10});

      const originalValue = {close: 13, high: 14, low: 9, open: 10} as const;
      const replacedValue = {close: 10, high: 17, low: 9, open: 16} as const;

      const originalResult = qstick.add(originalValue);

      expect(originalResult).toBe(2);

      const replacedResult = qstick.replace(replacedValue);

      expect(replacedResult).toBe(-1);

      const restoredResult = qstick.replace(originalValue);

      expect(restoredResult).toBe(2);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before any candle was added', () => {
      const qstick = new Qstick(2);

      expect(qstick.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns UNKNOWN as long as the window is not filled', () => {
      const qstick = new Qstick(2);

      qstick.add({close: 15, high: 16, low: 9, open: 10});

      expect(qstick.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when buyers close candles above their opens', () => {
      const qstick = new Qstick(2);

      qstick.add({close: 15, high: 16, low: 9, open: 10});
      qstick.add({close: 14, high: 16, low: 9, open: 11});

      expect(qstick.getResultOrThrow()).toBeGreaterThan(0);
      expect(qstick.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BULLISH,
      });
    });

    it('returns BEARISH when sellers pin closes below the opens', () => {
      const qstick = new Qstick(2);

      qstick.add({close: 10, high: 16, low: 9, open: 15});
      qstick.add({close: 11, high: 16, low: 9, open: 14});

      expect(qstick.getResultOrThrow()).toBeLessThan(0);
      expect(qstick.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });

    it('returns SIDEWAYS for a window of dojis closing exactly where they opened', () => {
      const qstick = new Qstick(2);

      qstick.add({close: 10, high: 12, low: 9, open: 10});
      qstick.add({close: 11, high: 13, low: 10, open: 11});

      expect(qstick.getResultOrThrow()).toBe(0);
      expect(qstick.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.SIDEWAYS,
      });
    });

    it('keeps the signal unchanged while buyers stay in control', () => {
      const qstick = new Qstick(2);

      qstick.add({close: 15, high: 16, low: 9, open: 10});
      qstick.add({close: 14, high: 16, low: 9, open: 11});
      qstick.add({close: 16, high: 17, low: 10, open: 12});

      expect(qstick.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BULLISH,
      });
    });

    it('flags the change when control flips from buyers to sellers', () => {
      const qstick = new Qstick(2);

      qstick.add({close: 15, high: 16, low: 9, open: 10});
      qstick.add({close: 14, high: 16, low: 9, open: 11});
      qstick.add({close: 9, high: 17, low: 8, open: 16});

      expect(qstick.getResultOrThrow()).toBeLessThan(0);
      expect(qstick.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });
  });
});

testIndicatorContract({
  create: () => new Qstick(5),
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
