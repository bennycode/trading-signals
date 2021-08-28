import {NotEnoughDataError} from '../error';
import {CG} from './CG';

describe('CG', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const cg = new CG(3, 6);
      cg.update(1);
      cg.update(2);
      expect(cg.prices.length).toBe(2);
      cg.update(3);
      expect(cg.prices.length).toBe(3);
      cg.update(4);
      expect(cg.prices.length).toBe(3);
      cg.update(5);
      expect(cg.prices.length).toBe(3);
      cg.update(6);
      expect(cg.prices.length).toBe(3);
    });
  });

  describe('isStable', () => {
    it('is stable when the inputs can fill the signal interval', () => {
      const cg = new CG(5, 6);
      cg.update(10);
      cg.update(20);
      cg.update(30);
      cg.update(40);
      expect(cg.isStable).toBeFalse();
      cg.update(50);
      expect(cg.isStable).toBeFalse();
      cg.update(60);
      expect(cg.isStable).toBeTrue();
      expect(cg.lowest!.toFixed(2)).toBe('1.00');
      expect(cg.highest!.toFixed(2)).toBe('3.67');
    });
  });

  describe('getResult', () => {
    it('indicates a downtrend when the center of gravity falls below the signal line', () => {
      const cg = new CG(5, 10);
      cg.update(100);
      cg.update(110);
      cg.update(120);
      cg.update(130);
      cg.update(140);
      cg.update(150);
      cg.update(160);
      cg.update(170);
      cg.update(180);
      cg.update(190);
      cg.update(200);
      let cgResult = cg.getResult();
      let signalResult = cg.signal.getResult();
      expect(cgResult.gt(signalResult)).toBeTrue();
      cg.update(150);
      cg.update(110);
      cgResult = cg.getResult();
      signalResult = cg.signal.getResult();
      expect(cgResult.gt(signalResult)).toBeFalse();
    });

    it('throws an error when there is not enough input data', () => {
      const cg = new CG(10, 20);

      try {
        cg.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('is protected against division by zero errors', () => {
      const cg = new CG(1, 1);
      cg.update(0);
      expect(cg.getResult().valueOf()).toBe('0');
    });
  });
});
