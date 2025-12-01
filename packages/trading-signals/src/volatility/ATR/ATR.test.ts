import {NotEnoughDataError} from '../../index.js';
import {ATR} from './ATR.js';

describe('ATR', () => {
  // Test data verified with:
  // https://tulipindicators.org/atr
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
    '1.12',
    '1.05',
    '1.01',
    '1.21',
    '1.14',
    '1.09',
    '1.24',
    '1.23',
    '1.23',
    '1.21',
    '1.14',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;
      const correct = {close: 3, high: 4, low: 1};
      const wrong = {close: 1_111, high: 9_999, low: 0};

      const atr = new ATR(interval);
      const atrWithReplace = new ATR(interval);

      atr.updates(candles, false);
      atrWithReplace.updates(candles, false);

      atr.add(correct);
      atrWithReplace.add(wrong);
      expect(atr.getResultOrThrow().toFixed()).not.toBe(atrWithReplace.getResultOrThrow().toFixed());

      atrWithReplace.replace(correct);
      expect(atr.getResultOrThrow().toFixed()).toBe(atrWithReplace.getResultOrThrow().toFixed());
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Average True Range (ATR)', () => {
      const interval = 5;
      const atr = new ATR(interval);

      for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        atr.add(candle);
        if (atr.isStable) {
          const expected = expectations[i - (interval - 1)];
          expect(atr.getResultOrThrow().toFixed(2)).toBe(expected);
        }
      }

      expect(atr.isStable).toBe(true);
      expect(atr.getRequiredInputs()).toBe(interval);
      expect(atr.getResultOrThrow().toFixed(2)).toBe('1.14');
    });

    it('throws an error when there is not enough input data', () => {
      const atr = new ATR(14);

      try {
        atr.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const interval = 5;
      const atr = new ATR(interval);

      for (const candle of candles) {
        atr.add(candle);
      }

      expect(atr.getResultOrThrow().toFixed(2)).toBe('1.14');

      // Add the latest value
      const latestValue = {close: 1337, high: 1337, low: 1337};
      const latestResult = '250.85';

      atr.add(latestValue);
      expect(atr.getResultOrThrow().toFixed(2)).toBe(latestResult);

      // Replace the latest value with some other value
      const someOtherValue = {
        close: 1,
        high: 1,
        low: 1,
      };
      const otherResult = '18.17';

      atr.replace(someOtherValue);
      expect(atr.getResultOrThrow().toFixed(2)).toBe(otherResult);

      // Replace the other value with the latest value
      atr.replace(latestValue);
      expect(atr.getResultOrThrow().toFixed(2)).toBe(latestResult);
    });
  });
});
