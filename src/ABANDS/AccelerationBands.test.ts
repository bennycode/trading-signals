import {AccelerationBands} from './AccelerationBands';
import {NotEnoughDataError} from '../error';
import {SMA} from '../SMA/SMA';
import {EMA} from '../EMA/EMA';

describe('AccelerationBands', () => {
  describe('constructor', () => {
    it('works with different kinds of indicators', () => {
      const accBandsWithSMA = new AccelerationBands(20, 2, SMA);
      const accBandsWithEMA = new AccelerationBands(20, 2, EMA);
      expect(accBandsWithSMA).toBeDefined();
      expect(accBandsWithEMA).toBeDefined();
    });
  });

  describe('getResult', () => {
    it('returns upper, middle and lower bands', () => {
      const accBands = new AccelerationBands(20, 4);
      // Test data from: https://github.com/QuantConnect/Lean/blob/master/Tests/TestData/spy_acceleration_bands_20_4.txt
      const candles = [
        {open: 196.25, high: 198.05, low: 194.96, close: 195.55},
        {open: 192.88, high: 193.86, low: 191.61, close: 192.59},
        {open: 195.97, high: 197.61, low: 195.17, close: 197.43},
        {open: 199.32, high: 199.47, low: 194.35, close: 194.79},
        {open: 194.5, high: 197.22, low: 194.25, close: 195.85},
        {open: 195.32, high: 196.82, low: 194.53, close: 196.74},
        {open: 196.95, high: 197.01, low: 195.43, close: 196.01},
        {open: 196.59, high: 198.99, low: 195.96, close: 198.46},
        {open: 198.82, high: 200.41, low: 198.41, close: 200.18},
        {open: 199.96, high: 202.89, low: 199.28, close: 199.73},
        {open: 195.74, high: 198.68, low: 194.96, close: 195.45},
        {open: 196.45, high: 197.68, low: 195.21, close: 196.46},
        {open: 193.9, high: 194.46, low: 192.56, close: 193.91},
        {open: 194.13, high: 194.67, low: 192.91, close: 193.6},
        {open: 192.13, high: 193.45, low: 190.56, close: 192.9},
        {open: 194.61, high: 195, low: 191.81, close: 192.85},
        {open: 191.75, high: 191.91, low: 187.64, close: 188.01},
        {open: 188.24, high: 189.74, low: 186.93, close: 188.12},
        {open: 190.4, high: 191.83, low: 189.44, close: 191.63},
        {open: 192.03, high: 192.49, low: 189.82, close: 192.13},
      ];

      for (const candle of candles) {
        const {high, low, close} = candle;
        accBands.update({high, low, close});
      }

      let result = accBands.getResult();

      // See: https://github.com/QuantConnect/Lean/blob/master/Tests/TestData/spy_acceleration_bands_20_4.txt#L21
      expect(result.lower.toFixed(4)).toBe('187.6891');
      expect(result.middle.toFixed(4)).toBe('194.6195');
      expect(result.upper.toFixed(4)).toBe('201.8016');

      // See: https://github.com/QuantConnect/Lean/blob/master/Tests/TestData/spy_acceleration_bands_20_4.txt#L22
      accBands.update({high: 195.03, low: 189.12, close: 195});
      result = accBands.getResult();
      expect(result.lower.toFixed(4)).toBe('187.1217');
      expect(result.middle.toFixed(4)).toBe('194.5920');
      expect(result.upper.toFixed(4)).toBe('201.9392');
    });

    it('throws an error when there is not enough input data', () => {
      const accBands = new AccelerationBands(20, 2);

      try {
        accBands.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
