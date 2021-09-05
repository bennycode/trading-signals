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
      const candles: number[][] = [
        [196.25, 198.05, 194.96, 195.55],
        [192.88, 193.86, 191.61, 192.59],
        [195.97, 197.61, 195.17, 197.43],
        [199.32, 199.47, 194.35, 194.79],
        [194.5, 197.22, 194.25, 195.85],
        [195.32, 196.82, 194.53, 196.74],
        [196.95, 197.01, 195.43, 196.01],
        [196.59, 198.99, 195.96, 198.46],
        [198.82, 200.41, 198.41, 200.18],
        [199.96, 202.89, 199.28, 199.73],
        [195.74, 198.68, 194.96, 195.45],
        [196.45, 197.68, 195.21, 196.46],
        [193.9, 194.46, 192.56, 193.91],
        [194.13, 194.67, 192.91, 193.6],
        [192.13, 193.45, 190.56, 192.9],
        [194.61, 195, 191.81, 192.85],
        [191.75, 191.91, 187.64, 188.01],
        [188.24, 189.74, 186.93, 188.12],
        [190.4, 191.83, 189.44, 191.63],
        [192.03, 192.49, 189.82, 192.13],
      ];

      candles.forEach(([_, high, low, close]) => {
        accBands.update(high, low, close);
      });

      let result = accBands.getResult();

      expect(result.lower.toFixed(4)).toBe('187.6891');
      expect(result.middle.toFixed(4)).toBe('194.6195');
      expect(result.upper.toFixed(4)).toBe('201.8016');

      accBands.update(195.03, 189.12, 195);

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
