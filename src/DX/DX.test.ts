import {DX, FasterDX} from './DX';

describe('DX', () => {
  describe('getResult', () => {
    it('calculates the Directional Movement Index (DX)', () => {
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

      const dx = new DX(5);
      const fasterDX = new FasterDX(5);

      for (const candle of candles) {
        dx.update(candle);
        fasterDX.update(candle);
        if (dx.isStable && fasterDX.isStable) {
          const expected = expectations.shift()!;
          expect(dx.getResult().toFixed(2)).toBe(expected);
          expect(fasterDX.getResult().toFixed(2)).toBe(expected);
        }
      }

      expect(dx.isStable).toBeTrue();
      expect(fasterDX.isStable).toBeTrue();

      expect(dx.getResult().toFixed(2)).toBe('75.61');
      expect(fasterDX.getResult().toFixed(2)).toBe('75.61');

      expect(dx.lowest!.toFixed(2)).toBe('11.09');
      expect(fasterDX.lowest!.toFixed(2)).toBe('11.09');

      expect(dx.highest!.toFixed(2)).toBe('86.51');
      expect(fasterDX.highest!.toFixed(2)).toBe('86.51');
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

      for (const candle of candles) {
        dx.update(candle);
        fasterDX.update(candle);
      }

      expect(dx.isStable).toBeTrue();
      expect(fasterDX.isStable).toBeTrue();

      expect(dx.getResult().valueOf()).toBe('0');
      expect(fasterDX.getResult().valueOf()).toBe(0);
    });
  });
});
