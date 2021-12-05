import {AccelerationBands, FasterAccelerationBands} from './AccelerationBands';
import {NotEnoughDataError} from '../error';
import {SMA} from '../SMA/SMA';
import {EMA} from '../EMA/EMA';
import {HighLowCloseNumber} from '../util';

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
      expect(accBands.isStable).toBeFalse();

      const fasterAccBands = new FasterAccelerationBands(20, 4);
      expect(fasterAccBands.isStable).toBeFalse();

      // Test data from: https://github.com/QuantConnect/Lean/blob/master/Tests/TestData/spy_acceleration_bands_20_4.txt
      const candles = [
        {close: 195.55, high: 198.05, low: 194.96, open: 196.25},
        {close: 192.59, high: 193.86, low: 191.61, open: 192.88},
        {close: 197.43, high: 197.61, low: 195.17, open: 195.97},
        {close: 194.79, high: 199.47, low: 194.35, open: 199.32},
        {close: 195.85, high: 197.22, low: 194.25, open: 194.5},
        {close: 196.74, high: 196.82, low: 194.53, open: 195.32},
        {close: 196.01, high: 197.01, low: 195.43, open: 196.95},
        {close: 198.46, high: 198.99, low: 195.96, open: 196.59},
        {close: 200.18, high: 200.41, low: 198.41, open: 198.82},
        {close: 199.73, high: 202.89, low: 199.28, open: 199.96},
        {close: 195.45, high: 198.68, low: 194.96, open: 195.74},
        {close: 196.46, high: 197.68, low: 195.21, open: 196.45},
        {close: 193.91, high: 194.46, low: 192.56, open: 193.9},
        {close: 193.6, high: 194.67, low: 192.91, open: 194.13},
        {close: 192.9, high: 193.45, low: 190.56, open: 192.13},
        {close: 192.85, high: 195, low: 191.81, open: 194.61},
        {close: 188.01, high: 191.91, low: 187.64, open: 191.75},
        {close: 188.12, high: 189.74, low: 186.93, open: 188.24},
        {close: 191.63, high: 191.83, low: 189.44, open: 190.4},
        {close: 192.13, high: 192.49, low: 189.82, open: 192.03},
      ];

      for (const candle of candles) {
        const {close, high, low} = candle;
        accBands.update({close, high, low});
        fasterAccBands.update({close, high, low});
      }

      let result = accBands.getResult();
      let fasterResult = fasterAccBands.getResult();

      // See: https://github.com/QuantConnect/Lean/blob/master/Tests/TestData/spy_acceleration_bands_20_4.txt#L21
      expect(accBands.isStable).toBeTrue();
      expect(fasterAccBands.isStable).toBeTrue();

      expect(result.lower.toFixed(4)).toBe('187.6891');
      expect(fasterResult.lower.toFixed(4)).toBe('187.6891');

      expect(result.middle.toFixed(4)).toBe('194.6195');
      expect(fasterResult.middle.toFixed(4)).toBe('194.6195');

      expect(result.upper.toFixed(4)).toBe('201.8016');
      expect(fasterResult.upper.toFixed(4)).toBe('201.8016');

      // See: https://github.com/QuantConnect/Lean/blob/master/Tests/TestData/spy_acceleration_bands_20_4.txt#L22
      const candle: HighLowCloseNumber = {close: 195, high: 195.03, low: 189.12};
      accBands.update(candle);
      fasterAccBands.update(candle);

      result = accBands.getResult();
      fasterResult = fasterAccBands.getResult();

      expect(result.lower.toFixed(4)).toBe('187.1217');
      expect(fasterResult.lower.toFixed(4)).toBe('187.1217');

      expect(result.middle.toFixed(4)).toBe('194.5920');
      expect(fasterResult.middle.toFixed(4)).toBe('194.5920');

      expect(result.upper.toFixed(4)).toBe('201.9392');
      expect(fasterResult.upper.toFixed(4)).toBe('201.9392');
    });

    it('throws an error when there is not enough input data', () => {
      const accBands = new AccelerationBands(20, 2);
      try {
        accBands.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }

      const fasterAccBands = new FasterAccelerationBands(20, 2);
      try {
        fasterAccBands.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
