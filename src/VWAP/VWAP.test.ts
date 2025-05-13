import {VWAP} from './VWAP.js';

// @see https://github.com/cinar/indicatorts/blob/main/src/indicator/volume/volumeWeightedAveragePrice.test.ts
describe('VWAP', () => {
  describe('VWAP', () => {
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

      expect(vwap.getResultOrThrow().toFixed()).toBe('9.18');
    });

    it('handles zero volume correctly', () => {
      const vwap = new VWAP();
      const result = vwap.add({close: 9, high: 10, low: 8, volume: 0});
      expect(result).toBe(null);
    });
  });

  // describe('FasterVWAP', () => {
  //   it('calculates VWAP correctly', () => {
  //     const vwap = new FasterVWAP();

  //     // Add test data (price, volume)
  //     const data = [
  //       {high: 10, low: 8, close: 9, volume: 100}, // TP: 9, TPV: 900
  //       {high: 12, low: 10, close: 11, volume: 200}, // TP: 11, TPV: 2200
  //       {high: 13, low: 9, close: 10, volume: 150}, // TP: 10.67, TPV: 1600.5
  //     ];

  //     // First data point
  //     let result = vwap.add(data[0]);
  //     expect(result).toBeCloseTo(9);

  //     // Second data point
  //     result = vwap.add(data[1]);
  //     // VWAP = (9*100 + 11*200) / (100 + 200) = 3100 / 300 = 10.33...
  //     expect(result).toBeCloseTo(10.33333, 5);

  //     // Third data point
  //     result = vwap.add(data[2]);
  //     // VWAP = (9*100 + 11*200 + 10.67*150) / (100 + 200 + 150) = 4700.5 / 450 = 10.445...
  //     expect(result).toBeCloseTo(10.44556, 5);

  //     // Test reset functionality
  //     vwap.reset();
  //     expect(vwap.getResult()).toBe(null);

  //     // Test that adding new data works after reset
  //     result = vwap.add(data[0]);
  //     expect(result).toBeCloseTo(9);
  //   });

  //   it('throws error when trying to replace values', () => {
  //     const vwap = new FasterVWAP();

  //     // Add initial data
  //     vwap.add({high: 10, low: 8, close: 9, volume: 100});

  //     // Attempting to replace should throw an error
  //     expect(() => vwap.replace({high: 11, low: 9, close: 10, volume: 120})).toThrow(
  //       'Replace operation is not supported for VWAP'
  //     );
  //   });

  //   it('throws NotEnoughDataError when there is not enough data', () => {
  //     const vwap = new FasterVWAP();

  //     expect(() => vwap.getResultOrThrow()).toThrow(NotEnoughDataError);
  //   });

  //   it('handles zero volume correctly', () => {
  //     const vwap = new FasterVWAP();

  //     // Add with zero volume
  //     const result = vwap.add({high: 10, low: 8, close: 9, volume: 0});

  //     // VWAP should be null when volume is zero
  //     expect(result).toBe(null);
  //   });

  //   it('maintains cumulative calculations correctly', () => {
  //     const vwap = new FasterVWAP();

  //     // Add test data with consistent prices to verify cumulative calculations
  //     vwap.add({high: 10, low: 10, close: 10, volume: 100}); // TP: 10, TPV: 1000
  //     const result = vwap.add({high: 10, low: 10, close: 10, volume: 200}); // TP: 10, TPV: 2000

  //     // VWAP = (10*100 + 10*200) / (100 + 200) = 3000 / 300 = 10
  //     expect(result).toBe(10);
  //   });
  // });
});
