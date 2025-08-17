import {VWAP} from './VWAP.js';

// @see https://github.com/cinar/indicatorts/blob/main/src/indicator/volume/volumeWeightedAveragePrice.test.ts
describe('VWAP', () => {
  describe('add', () => {
    it('handles zero volume correctly', () => {
      const vwap = new VWAP();
      const result = vwap.add({close: 9, high: 10, low: 8, volume: 0});
      expect(result).toBe(null);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const vwap = new VWAP();

      const data = [
        {close: 100, high: 100, low: 100, volume: 100},
        {close: 200, high: 200, low: 200, volume: 200},
        {close: 300, high: 300, low: 300, volume: 300},
        {close: 400, high: 400, low: 400, volume: 400},
      ] as const;

      data.forEach(input => {
        vwap.add(input);
      });
      expect(vwap.getResultOrThrow().toFixed()).toBe('300');

      const replaceValue = {close: 120, high: 120, low: 120, volume: 120};
      vwap.replace(replaceValue);
      expect(vwap.getResultOrThrow().toFixed(2)).toBe('214.44');

      vwap.replace(data[data.length - 1]);
      expect(vwap.getResultOrThrow().toFixed()).toBe('300');
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates VWAP correctly', () => {
      const vwap = new VWAP();

      // Test data verified with:
      // https://github.com/cinar/indicatorts/blob/v2.2.2/src/indicator/volume/volumeWeightedAveragePrice.test.ts
      const data = [
        {close: 9, high: 9, low: 9, volume: 100},
        {close: 11, high: 11, low: 11, volume: 110},
        {close: 7, high: 7, low: 7, volume: 80},
        {close: 10, high: 10, low: 10, volume: 120},
        {close: 8, high: 8, low: 8, volume: 90},
      ] as const;

      const expected = ['9.00', '10.05', '9.21', '9.44', '9.18'] as const;

      for (const [index, input] of data.entries()) {
        const result = vwap.add(input);
        expect(result?.toFixed(2)).toBe(expected[index]);
      }

      expect(vwap.getRequiredInputs()).toBe(2);
      expect(vwap.getResultOrThrow().toFixed(2)).toBe('9.18');
    });
  });
});
