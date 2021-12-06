import {ADX, FasterADX} from './ADX';

describe('ADX', () => {
  describe('getResult', () => {
    it('calculates the Average Directional Index (ADX)', () => {
      // Test data verified with:
      // https://tulipindicators.org/adx
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

      const expectations = [41.38, 44.29, 49.42, 54.92, 59.99, 65.29, 67.36];

      const adx = new ADX(5);
      const fasterADX = new FasterADX(5);

      for (const candle of candles) {
        adx.update(candle);
        fasterADX.update(candle);
        if (adx.isStable && fasterADX.isStable) {
          const expected = expectations.shift();
          expect(adx.getResult().toFixed(2)).toBe(`${expected}`);
          expect(fasterADX.getResult().toFixed(2)).toBe(`${expected}`);
        }
      }

      expect(adx.isStable).toBeTrue();
      expect(fasterADX.isStable).toBeTrue();

      expect(adx.getResult().toFixed(2)).toBe('67.36');
      expect(fasterADX.getResult().toFixed(2)).toBe('67.36');

      expect(adx.lowest!.toFixed(2)).toBe('41.38');
      expect(fasterADX.lowest!.toFixed(2)).toBe('41.38');

      expect(adx.highest!.toFixed(2)).toBe('67.36');
      expect(fasterADX.highest!.toFixed(2)).toBe('67.36');

      // Verify uptrend detection (+DI > -DI):
      expect(adx.pdi!.gt(adx.mdi!)).toBeTrue();
      expect(fasterADX.pdi > fasterADX.mdi).toBeTrue();

      expect(adx.pdi!.toFixed(2)).toBe('0.42');
      expect(fasterADX.pdi!.toFixed(2)).toBe('0.42');

      expect(adx.mdi!.toFixed(2)).toBe('0.06');
      expect(fasterADX.mdi!.toFixed(2)).toBe('0.06');
    });
  });
});
