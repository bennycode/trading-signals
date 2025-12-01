import {TR} from './TR.js';

describe('TR', () => {
  // Test data verified with:
  // https://tulipindicators.org/tr
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
    '0.86',
    '1.25',
    '1.97',
    '0.65',
    '0.85',
    '0.79',
    '0.84',
    '2.00',
    '0.85',
    '0.89',
    '1.87',
    '1.19',
    '1.22',
    '1.11',
    '0.86',
  ] as const;

  describe('getResultOrThrow', () => {
    it('calculates the True Range (TR)', () => {
      const tr = new TR();

      candles.forEach((candle, i) => {
        tr.add(candle);
        if (tr.isStable) {
          const expected = expectations[i];
          expect(tr.getResultOrThrow().toFixed(2)).toBe(expected);
        }
      });

      expect(tr.isStable).toBe(true);
      expect(tr.getRequiredInputs()).toBe(2);
      expect(tr.getResultOrThrow().toFixed(2)).toBe('0.86');
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const tr = new TR();

      // Update candles except last one.
      candles.slice(-1).forEach(candle => {
        tr.add(candle);
      });

      const lastCandle = candles.at(-1);
      const latestResult = expectations.at(-1);

      // Add the latest value
      if (lastCandle) {
        tr.add(lastCandle);
      }

      expect(tr.getResultOrThrow().toFixed(2)).toBe(latestResult);

      // Replace the latest value with some other value
      const someOtherValue = {close: 84.55, high: 84.84, low: 84.15};
      const otherResult = '3.14';

      tr.replace(someOtherValue);
      expect(tr.getResultOrThrow().toFixed(2)).toBe(otherResult);

      // Replace the other value with the latest value
      if (lastCandle) {
        tr.replace(lastCandle);
      }

      expect(tr.getResultOrThrow().toFixed(2)).toBe(latestResult);
    });
  });
});
