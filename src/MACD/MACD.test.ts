import {MACD} from './MACD';
import Big from 'big.js';
import {DEMA, EMA, NotEnoughDataError} from '..';

describe('MACD', () => {
  describe('getResult', () => {
    it('is compatible with results from Tulip Indicators (TI)', () => {
      // Test data taken from:
      // https://tulipindicators.org/macd
      const inputs = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];

      const expectedMacds = [
        undefined,
        undefined,
        undefined,
        undefined,
        '0.62',
        '0.35',
        '0.11',
        '0.42',
        '0.58',
        '0.42',
        '0.68',
        '0.93',
        '0.89',
        '0.98',
        '0.62',
      ];

      const expectedMacdSignals = [
        undefined,
        undefined,
        undefined,
        undefined,
        '0.62',
        '0.56',
        '0.47',
        '0.46',
        '0.49',
        '0.47',
        '0.51', // Note: Tulip indicators example (https://tulipindicators.org/macd) shows "0.52" because they are
        // rounding "0.51492" up.
        '0.60',
        '0.66',
        '0.72',
        '0.70',
      ];

      const expectedMacdHistograms = [
        undefined,
        undefined,
        undefined,
        undefined,
        '0.00',
        '-0.21',
        '-0.36',
        '-0.05',
        '0.09',
        '-0.05',
        '0.17',
        '0.33',
        '0.24',
        '0.26',
        '-0.08',
      ];

      const indicator = new MACD({
        indicator: EMA,
        longInterval: 5,
        shortInterval: 2,
        signalInterval: 9,
      });

      for (const [index, input] of Object.entries(inputs)) {
        indicator.update(input);

        const key = parseInt(index, 10);
        const expectedMacd = expectedMacds[key]!;
        const expectedMacdSignal = expectedMacdSignals[key]!;
        const expectedMacdHistogram = expectedMacdHistograms[key]!;

        if (expectedMacd !== undefined) {
          const result = indicator.getResult();
          expect(result.macd.toFixed(2)).withContext('MACD').toBe(expectedMacd);
          expect(result.signal.toFixed(2)).withContext('MACD Signal').toBe(expectedMacdSignal);
          expect(result.histogram.toFixed(2)).withContext('MACD Histogram').toBe(expectedMacdHistogram);
        }
      }
    });

    it('throws an error when there is not enough input data', () => {
      const macd = new MACD({
        indicator: DEMA,
        longInterval: 26,
        shortInterval: 12,
        signalInterval: 9,
      });

      try {
        macd.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('knows when it can return reliable data', () => {
      const longInterval = 18;
      const macd = new MACD({
        indicator: EMA,
        longInterval,
        shortInterval: 9,
        signalInterval: 9,
      });

      const mockedPrices = [
        new Big('0.00019040'),
        new Big('0.00019071'),
        new Big('0.00019198'),
        new Big('0.00019220'),
        new Big('0.00019214'),
        new Big('0.00019205'),
        new Big('0.00019214'),
        new Big('0.00019222'),
        new Big('0.00019144'),
        new Big('0.00019128'),
        new Big('0.00019159'),
        new Big('0.00019143'),
        new Big('0.00019199'),
        new Big('0.00019214'),
        new Big('0.00019119'),
        new Big('0.00019202'),
        new Big('0.00019220'),
        new Big('0.00019207'),
      ];

      expect(mockedPrices.length).toBe(longInterval);
      expect(macd.isStable).toBeFalse();

      mockedPrices.forEach(price => macd.update(price));

      expect(macd.isStable).toBeTrue();
    });
  });
});
