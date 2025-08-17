import {MACD} from './MACD.js';
import {EMA} from '../EMA/EMA.js';
import {NotEnoughDataError} from '../error/index.js';

describe('MACD', () => {
  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const macd = new MACD(new EMA(2), new EMA(5), new EMA(9));
      const macdWithReplace = new MACD(new EMA(2), new EMA(5), new EMA(9));
      const subset = [10, 20, 80, 81.59, 81.06, 82.87, 83.0];

      macd.updates([...subset, 90, 83.61], false);

      macdWithReplace.updates([...subset, 100], false);
      macdWithReplace.replace(90);
      macdWithReplace.add(83.61);

      expect(macdWithReplace.short.getResultOrThrow().toFixed(), 'short').toBe(macd.short.getResultOrThrow().toFixed());
      expect(macdWithReplace.long.getResultOrThrow().toFixed(), 'long').toBe(macd.long.getResultOrThrow().toFixed());
      expect(macdWithReplace.getResultOrThrow().histogram.toFixed(), 'histogram').toBe(
        macd.getResultOrThrow().histogram.toFixed()
      );
      expect(macdWithReplace.getResultOrThrow().macd.toFixed(), 'macd').toBe(macd.getResultOrThrow().macd.toFixed());
      expect(macdWithReplace.getResultOrThrow().signal.toFixed(), 'signal').toBe(
        macd.getResultOrThrow().signal.toFixed()
      );
    });
  });

  describe('update', () => {
    it('can replace recently added values', () => {
      const fasterMACD = new MACD(new EMA(2), new EMA(5), new EMA(9));

      const subset = [81.59, 81.06, 82.87, 83.0];
      fasterMACD.updates(subset, false);

      fasterMACD.add(90); // this value gets replaced with the next call
      fasterMACD.replace(83.61);

      expect(fasterMACD.isStable).toBe(true);
      expect(fasterMACD.getResultOrThrow().macd.toFixed(2)).toBe('0.62');
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', () => {
      // Test data verified with:
      // https://tulipindicators.org/macd
      const prices = [
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

      const macd = new MACD(new EMA(2), new EMA(5), new EMA(9));
      const fasterMACD = new MACD(new EMA(2), new EMA(5), new EMA(9));

      for (const [index, input] of Object.entries(prices)) {
        macd.add(input);
        fasterMACD.add(input);

        const key = parseInt(index, 10);
        const expectedMacd = expectedMacds[key];
        const expectedMacdSignal = expectedMacdSignals[key]!;
        const expectedMacdHistogram = expectedMacdHistograms[key]!;

        if (expectedMacd !== undefined) {
          const result = macd.getResultOrThrow();
          const fasterResult = fasterMACD.getResultOrThrow();

          expect(result.macd.toFixed(2)).toBe(expectedMacd);
          expect(fasterResult.macd.toFixed(2)).toBe(expectedMacd);

          expect(result.signal.toFixed(2)).toBe(expectedMacdSignal);
          expect(fasterResult.signal.toFixed(2)).toBe(expectedMacdSignal);

          expect(result.histogram.toFixed(2)).toBe(expectedMacdHistogram);
          expect(fasterResult.histogram.toFixed(2)).toBe(expectedMacdHistogram);
        }
      }

      expect(macd.isStable).toBe(true);
      expect(fasterMACD.isStable).toBe(true);
    });

    it('throws an error when there is not enough input data', () => {
      const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));

      try {
        macd.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }

      const fasterMACD = new MACD(new EMA(12), new EMA(26), new EMA(9));

      try {
        fasterMACD.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('knows when it can return reliable data', () => {
      const longInterval = 18;
      const macd = new MACD(new EMA(9), new EMA(longInterval), new EMA(9));

      const mockedPrices = [
        0.0001904, 0.00019071, 0.00019198, 0.0001922, 0.00019214, 0.00019205, 0.00019214, 0.00019222, 0.00019144,
        0.00019128, 0.00019159, 0.00019143, 0.00019199, 0.00019214, 0.00019119, 0.00019202, 0.0001922, 0.00019207,
      ];

      expect(mockedPrices.length).toBe(longInterval);
      expect(macd.isStable).toBe(false);

      macd.updates(mockedPrices, false);

      expect(macd.isStable).toBe(true);
    });
  });
});
