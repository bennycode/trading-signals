import {ADX} from './ADX.js';

describe('ADX', () => {
  // Test data verified with:
  // https://tulipindicators.org/adx
  // https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L36-L37
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

  // https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L38
  const expectations = [41.38, 44.29, 49.42, 54.92, 59.99, 65.29, 67.36] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;
      const adx = new ADX(interval);
      const adxWithReplace = new ADX(interval);

      adx.updates(candles, false);
      adxWithReplace.updates(candles, false);

      const correct = {close: 90, high: 90, low: 90};
      const wrong = {close: 1_000, high: 1_000, low: 1_000};

      adx.add(correct);
      adxWithReplace.add(wrong);

      expect(adx.getResultOrThrow().toFixed()).not.toBe(adxWithReplace.getResultOrThrow().toFixed());

      adxWithReplace.replace(correct);

      expect(adx.getResultOrThrow().toFixed()).toBe(adxWithReplace.getResultOrThrow().toFixed());
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Average Directional Index (ADX)', () => {
      const interval = 5;
      const adx = new ADX(interval);
      const offset = adx.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        adx.add(candle);
        if (adx.isStable) {
          const expected = expectations[i - offset];
          expect(adx.getResultOrThrow().toFixed(2)).toBe(`${expected}`);
        }
      });

      expect(adx.isStable).toBe(true);
      expect(adx.getRequiredInputs()).toBe(9);
      expect(adx.getResultOrThrow().toFixed(2)).toBe('67.36');

      // Verify uptrend detection (+DI > -DI):
      expect(adx.pdi > adx.mdi).toBe(true);
      expect(adx.pdi?.toFixed(2)).toBe('0.42');
      expect(adx.mdi?.toFixed(2)).toBe('0.06');
    });
  });

  describe('isStable', () => {
    it('requires at least (2x interval - 1) candles to produce a meaningful result (because of +DI and -DI warm-up)', () => {
      const interval = 5;
      const necessaryCandlesAmount = 2 * interval - 1;
      const initialCandles = candles.slice(0, necessaryCandlesAmount - 1);
      const adx = new ADX(interval);

      // Add necessary candles - 1
      adx.updates(initialCandles);
      expect(adx.isStable).toBe(false);

      // Add one more candle to make it stable
      adx.add({close: 10, high: 11, low: 9});
      expect(adx.isStable).toBe(true);
    });
  });
});
