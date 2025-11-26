import {DX} from './DX.js';

describe('DX', () => {
  // Test data verified with:
  // https://tulipindicators.org/dx
  // @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L167-L168
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

  // @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L169
  const expectations = [
    '50.19',
    '51.36',
    '11.09',
    '41.52',
    '52.77',
    '55.91',
    '69.96',
    '76.90', // The official TI page has a rounding mistake here
    '80.26',
    '86.51',
    '75.61',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;

      const correct = {close: 1_000, high: 1_000, low: 1_000};
      const wrong = {close: 9_000, high: 9_000, low: 9_000};

      const dx = new DX(interval);
      const dxWithReplace = new DX(interval);

      dx.updates(candles, false);
      dxWithReplace.updates(candles, false);
      dx.add(correct);
      dxWithReplace.add(wrong);

      // We need to verify the four decimal places, as the results are otherwise too similar:
      expect(dx.getResultOrThrow().toFixed(4)).not.toBe(dxWithReplace.getResultOrThrow().toFixed(4));
      dxWithReplace.replace(correct);
      expect(dx.getResultOrThrow().toFixed(4)).toBe(dxWithReplace.getResultOrThrow().toFixed(4));
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Directional Movement Index (DX)', () => {
      const interval = 5;
      const dx = new DX(interval);
      const offset = dx.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        dx.add(candle);
        if (dx.isStable) {
          const expected = expectations[i - offset];
          expect(dx.getResultOrThrow().toFixed(2)).toBe(expected);
        }
      });

      expect(dx.isStable).toBe(true);
      expect(dx.getRequiredInputs()).toBe(interval);
      expect(dx.getResultOrThrow().toFixed(2)).toBe('75.61');
    });

    it('returns zero when there is no trend', () => {
      const candles = [
        {close: 95, high: 100, low: 90},
        {close: 95, high: 100, low: 90},
        {close: 95, high: 100, low: 90},
        {close: 95, high: 100, low: 90},
        {close: 95, high: 100, low: 90},
      ];

      const dx = new DX(5);
      dx.updates(candles, false);

      expect(dx.isStable).toBe(true);
      expect(dx.getResultOrThrow()).toBe(0);
    });
  });
});
