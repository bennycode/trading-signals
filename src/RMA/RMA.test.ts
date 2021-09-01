import {RMA} from './RMA';
import {NotEnoughDataError} from '../error';

describe('RMA', () => {
  describe('getResult', () => {
    it('calculates the RMA based on a SMA', () => {
      // Test vectors taken from:
      // https://runkit.com/anandaravindan/wema
      const prices = [11, 12, 13, 14, 15, 16, 18, 19, 22, 23, 23];
      const expectations = ['', '', '', '', '13.00', '13.60', '14.48', '15.38', '16.71', '17.97', '18.97'];
      const rma = new RMA(5);

      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const result = rma.update(price);
        if (result) {
          const expected = expectations[i];
          expect(result.toFixed(2)).toBe(expected);
        }
      }

      expect(rma.getResult().toFixed(2)).toBe(expectations[expectations.length - 1]);
    });
  });

  describe('isStable', () => {
    it('is stable when the inputs can fill the signal interval', () => {
      const rma = new RMA(3);
      rma.update(1);
      rma.update(2);
      expect(rma.isStable).toBeFalse();
      rma.update(3);
      expect(rma.isStable).toBeTrue();
    });

    it('throws an error when there is no input data', () => {
      const rma = new RMA(3);

      try {
        rma.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('throws an error when there is not enough input data', () => {
      const rma = new RMA(3);
      rma.update(1);
      rma.update(2);

      try {
        rma.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
