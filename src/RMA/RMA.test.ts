import {RMA} from './RMA';

describe('RMA', () => {
  describe('getResult', () => {
    it('calculates the RMA with interval 10', () => {
      const rma = new RMA(10);
      rma.update(3);
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
