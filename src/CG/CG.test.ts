import {NotEnoughDataError} from '../error/index.js';
import {CG, FasterCG} from './CG.js';

describe('CG', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const cg = new CG(3, 6);
      cg.add(1);
      cg.add(2);
      expect(cg.prices.length).toBe(2);
      cg.add(3);
      expect(cg.prices.length).toBe(3);
      cg.add(4);
      expect(cg.prices.length).toBe(3);
      cg.add(5);
      expect(cg.prices.length).toBe(3);
      cg.add(6);
      expect(cg.prices.length).toBe(3);
    });
  });

  describe('isStable', () => {
    it('is stable when the inputs can fill the signal interval', () => {
      const cg = new CG(5, 6);
      cg.add(10);
      cg.add(20);
      cg.add(30);
      cg.add(40);
      expect(cg.isStable).toBe(false);
      cg.add(50);
      expect(cg.isStable).toBe(false);
      cg.add(60);
      expect(cg.isStable).toBe(true);
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const cg = new CG(5, 10);
      const fasterCG = new FasterCG(5, 10);

      const values = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
      for (const value of values) {
        cg.add(value);
        fasterCG.add(value);
      }

      // Add the latest value
      const latestValue = 200;
      const latestResult = '3.0851';
      const latestLow = '3.0851';
      const latestHigh = '3.1176';

      cg.add(latestValue);
      expect(cg.prices.length).toBe(5);
      expect(cg.getResult().toFixed(4)).toBe(latestResult);
      expect(cg.lowest?.toFixed(4)).toBe(latestLow);
      expect(cg.highest?.toFixed(4)).toBe(latestHigh);

      fasterCG.add(latestValue);
      expect(fasterCG.prices.length).toBe(5);
      expect(fasterCG.getResult().toFixed(4)).toBe(latestResult);
      expect(fasterCG.lowest?.toFixed(4)).toBe(latestLow);
      expect(fasterCG.highest?.toFixed(4)).toBe(latestHigh);

      // Replace the latest value with some other value
      const someOtherValue = 900;
      const otherResult = '3.9024';
      const otherLow = '3.1111';
      const otherHigh = '3.9024';

      cg.replace(someOtherValue);
      expect(cg.prices.length).toBe(5);
      expect(cg.getResult().toFixed(4)).toBe(otherResult);
      expect(cg.lowest?.toFixed(4)).toBe(otherLow);
      expect(cg.highest?.toFixed(4)).toBe(otherHigh);

      fasterCG.replace(someOtherValue);
      expect(fasterCG.prices.length).toBe(5);
      expect(fasterCG.getResult().toFixed(4)).toBe(otherResult);
      expect(fasterCG.lowest?.toFixed(4)).toBe(otherLow);
      expect(fasterCG.highest?.toFixed(4)).toBe(otherHigh);

      // Replace the other value with the latest value
      cg.replace(latestValue);
      expect(cg.prices.length).toBe(5);
      expect(cg.getResult().toFixed(4)).toBe(latestResult);
      expect(cg.lowest?.toFixed(4)).toBe(latestLow);
      expect(cg.highest?.toFixed(4)).toBe(latestHigh);

      fasterCG.replace(latestValue);
      expect(fasterCG.prices.length).toBe(5);
      expect(fasterCG.getResult().toFixed(4)).toBe(latestResult);
      expect(fasterCG.lowest?.toFixed(4)).toBe(latestLow);
      expect(fasterCG.highest?.toFixed(4)).toBe(latestHigh);
    });
  });

  describe('getResult', () => {
    it('indicates a downtrend when the center of gravity falls below the signal line', () => {
      const cg = new CG(5, 10);
      const fasterCG = new FasterCG(5, 10);
      const values = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
      for (const value of values) {
        cg.add(value);
        fasterCG.add(value);
      }
      let cgResult = cg.getResult();
      let signalResult = cg.signal.getResult();
      expect(cgResult.gt(signalResult)).toBe(true);
      [150, 110, 90, 130].forEach(price => {
        cg.add(price);
        fasterCG.add(price);
      });

      expect(cg.isStable).toBe(true);
      expect(fasterCG.isStable).toBe(true);

      cgResult = cg.getResult();
      signalResult = cg.signal.getResult();
      expect(cgResult.gt(signalResult)).toBe(false);

      expect(cgResult.toFixed(4)).toBe('2.7059');
      expect(fasterCG.getResult().toFixed(4)).toBe('2.7059');

      expect(cg.lowest?.toFixed(4)).toBe('2.6081');
      expect(fasterCG.lowest?.toFixed(4)).toBe('2.6081');

      expect(cg.highest?.toFixed(4)).toBe('3.1176');
      expect(fasterCG.highest?.toFixed(4)).toBe('3.1176');
    });

    it('throws an error when there is not enough input data', () => {
      const cg = new CG(10, 20);

      try {
        cg.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('is protected against division by zero errors', () => {
      const cg = new CG(1, 1);
      cg.add(0);
      expect(cg.getResult().valueOf()).toBe('0');

      const fasterCG = new FasterCG(1, 1);
      fasterCG.add(0);
      expect(fasterCG.getResult().valueOf()).toBe(0);
    });
  });
});
