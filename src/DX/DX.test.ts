import {DX, FasterDX} from './DX.js';

describe('DX', () => {
  // Test data verified with:
  // https://tulipindicators.org/dx
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
    it('guarantees that a replacement is done correctly', () => {
      const interval = 5;
      const dx = new DX(interval);
      const dxWithReplace = new DX(interval);

      const correct = {close: 1_000, high: 1_000, low: 1_000};
      const wrong = {close: 9_000, high: 9_000, low: 9_000};

      dx.updates(candles, false);
      dxWithReplace.updates(candles, false);

      dx.add(correct);
      dxWithReplace.add(wrong);

      expect(dx.getResult().toFixed()).not.toBe(dxWithReplace.getResult().toFixed());

      dxWithReplace.replace(correct);

      expect(dx.getResult().toFixed()).toBe(dxWithReplace.getResult().toFixed());
    });
  });

  describe('getResult', () => {
    it('calculates the Directional Movement Index (DX)', () => {
      const interval = 5;
      const dx = new DX(interval);
      const fasterDX = new FasterDX(interval);

      for (const candle of candles) {
        dx.add(candle);
        fasterDX.add(candle);
        if (dx.isStable && fasterDX.isStable) {
          const expected = expectations.shift()!;
          expect(dx.getResult().toFixed(2)).toBe(expected);
          expect(fasterDX.getResult().toFixed(2)).toBe(expected);
        }
      }

      expect(dx.isStable).toBe(true);
      expect(fasterDX.isStable).toBe(true);

      expect(dx.getResult().toFixed(2)).toBe('75.61');
      expect(fasterDX.getResult().toFixed(2)).toBe('75.61');

      expect(dx.lowest?.toFixed(2)).toBe('11.09');
      expect(fasterDX.lowest?.toFixed(2)).toBe('11.09');

      expect(dx.highest?.toFixed(2)).toBe('86.51');
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

      const dx = new DX(5);
      const fasterDX = new FasterDX(5);

      dx.updates(candles, false);
      fasterDX.updates(candles, false);

      expect(dx.isStable).toBe(true);
      expect(fasterDX.isStable).toBe(true);

      expect(dx.getResult().valueOf()).toBe('0');
      expect(fasterDX.getResult().valueOf()).toBe(0);
    });
  });
});
