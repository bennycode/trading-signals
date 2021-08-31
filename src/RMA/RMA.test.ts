import {RMA} from './RMA';

describe('RMA', () => {
  describe('getResult', () => {
    fit('calculates the RMA with interval 10', () => {
      // https://runkit.com/anandaravindan/wema
      const prices = [11, 12, 13, 14, 15, 16, 18, 19, 22, 23, 23];
      const rma = new RMA(5);
      prices.forEach(price => {
        rma.update(price);
        if (rma.isStable) {
          //
        }
      });
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
  });
});
