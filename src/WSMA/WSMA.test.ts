import {WSMA} from './WSMA';
import {NotEnoughDataError} from '../error';

describe('WSMA', () => {
  describe('getResult', () => {
    it('calculates the WSMA based on a SMA', () => {
      // Test data taken from:
      // https://runkit.com/anandaravindan/wema
      const prices = [11, 12, 13, 14, 15, 16, 18, 19, 22, 23, 23];
      const results = ['', '', '', '', '13.00', '13.60', '14.48', '15.38', '16.71', '17.97', '18.97'];
      const wsma = new WSMA(5);

      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const result = wsma.update(price);
        if (result) {
          const expected = results[i];
          expect(result.toFixed(2)).toBe(expected);
        }
      }

      expect(wsma.getResult().toFixed(2)).toBe(results[results.length - 1]);
    });

    it('is compatible with results from Tulip Indicators (TI)', () => {
      // Test data taken from:
      // https://tulipindicators.org/wilders
      const prices = [81.59, 81.06, 82.87, 83.0, 83.61, 83.15];
      const results = ['', '', '', '', '82.43', '82.57'];
      const wsma = new WSMA(5);

      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const result = wsma.update(price);
        if (result) {
          const expected = results[i];
          expect(result.toFixed(2)).toBe(expected);
        }
      }

      expect(wsma.getResult().toFixed(2)).toBe(results[results.length - 1]);
    });

    it('throws an error when there is no input data', () => {
      const wsma = new WSMA(3);

      try {
        wsma.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('throws an error when there is not enough input data', () => {
      const wsma = new WSMA(3);
      wsma.update(1);
      wsma.update(2);

      try {
        wsma.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('is stable when the inputs can fill the signal interval', () => {
      const wsma = new WSMA(3);
      wsma.update(1);
      wsma.update(2);
      expect(wsma.isStable).toBeFalse();
      wsma.update(3);
      expect(wsma.isStable).toBeTrue();
    });
  });
});
