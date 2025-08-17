import {OBV} from './OBV.js';
import {NotEnoughDataError} from '../error/index.js';

describe('OBV', () => {
  describe('getResultOrThrow', () => {
    it('calculates the relative strength index', () => {
      // Test data verified with:
      // https://www.investopedia.com/terms/o/onbalancevolume.asp#mntl-sc-block_1-0-27
      const prices = [10, 10.15, 10.17, 10.13, 10.11, 10.15, 10.2, 10.2, 10.22, 10.21];
      const volumes = [25200, 30000, 25600, 32000, 23000, 40000, 36000, 20500, 23000, 27500];
      const candles = prices.map((price, index) => ({
        close: price,
        high: price,
        low: price,
        open: price,
        volume: volumes[index],
      }));
      const expectations = [
        '30000.000',
        '55600.000',
        '23600.000',
        '600.000',
        '40600.000',
        '76600.000',
        '76600.000',
        '99600.000',
        '72100.000',
      ];
      const fasterOBV = new OBV();
      for (const candle of candles) {
        fasterOBV.add(candle);
        if (fasterOBV.isStable) {
          const expected = expectations.shift();
          expect(fasterOBV.getResultOrThrow().toFixed(3)).toBe(expected);
        }
      }
      expect(fasterOBV.isStable).toBe(true);
      expect(fasterOBV.getRequiredInputs()).toBe(2);
      expect(fasterOBV.getResultOrThrow().toFixed(2)).toBe('72100.00');
      expect(fasterOBV.lowest?.toFixed(2)).toBe('600.00');
      expect(fasterOBV.highest?.toFixed(2)).toBe('99600.00');
    });

    it('throws an error when there is not enough input data', () => {
      const obv = new OBV();
      expect(obv.isStable).toBe(false);
      try {
        obv.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(obv.isStable).toBe(false);
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
