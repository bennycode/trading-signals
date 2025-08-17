import {FasterDX} from './DX.js';

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
  ];

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
  ];

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 5;

      const correct = {close: 1_000, high: 1_000, low: 1_000};
      const wrong = {close: 9_000, high: 9_000, low: 9_000};

      const fasterDX = new FasterDX(interval);
      const fasterDXWithReplace = new FasterDX(interval);

      fasterDX.updates(candles, false);
      fasterDXWithReplace.updates(candles, false);
      fasterDX.add(correct);
      fasterDXWithReplace.add(wrong);

      // We need to verify the four decimal places, as the results are otherwise too similar:
      expect(fasterDX.getResultOrThrow().toFixed(4)).not.toBe(fasterDXWithReplace.getResultOrThrow().toFixed(4));
      fasterDXWithReplace.replace(correct);
      expect(fasterDX.getResultOrThrow().toFixed(4)).toBe(fasterDXWithReplace.getResultOrThrow().toFixed(4));
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the Directional Movement Index (DX)', () => {
      const interval = 5;
      const fasterDX = new FasterDX(interval);

      for (const candle of candles) {
        fasterDX.add(candle);
        if (fasterDX.isStable) {
          const expected = expectations.shift();
          expect(fasterDX.getResultOrThrow().toFixed(2)).toBe(expected);
        }
      }

  expect(fasterDX.isStable).toBe(true);
  expect(fasterDX.getRequiredInputs()).toBe(interval);
  expect(fasterDX.getResultOrThrow().toFixed(2)).toBe('75.61');
  expect(fasterDX.lowest?.toFixed(2)).toBe('11.09');
  expect(fasterDX.highest?.toFixed(2)).toBe('86.51');
    });

    it('returns zero when there is no trend', () => {
      const candles = [
        {close: 95, high: 100, low: 90},
        {close: 95, high: 100, low: 90},
        {close: 95, high: 100, low: 90},
        {close: 95, high: 100, low: 90},
        {close: 95, high: 100, low: 90},
      ];

      const fasterDX = new FasterDX(5);
      fasterDX.updates(candles, false);

  expect(fasterDX.isStable).toBe(true);
  expect(fasterDX.getResultOrThrow()).toBe(0);
    });
  });
});
