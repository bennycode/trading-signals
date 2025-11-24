import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../types/Indicator.js';
import {CG} from './CG.js';

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

      const prices = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
      for (const price of prices) {
        cg.add(price);
      }

      // Add the latest value
      const latestValue = 200;
      const latestResult = '3.0851';

      cg.add(latestValue);
      expect(cg.prices.length).toBe(5);
      expect(cg.getResultOrThrow().toFixed(4)).toBe(latestResult);

      // Replace the latest value with some other value
      const someOtherValue = 900;
      const otherResult = '3.9024';

      cg.replace(someOtherValue);
      expect(cg.prices.length).toBe(5);
      expect(cg.getResultOrThrow().toFixed(4)).toBe(otherResult);

      // Replace the other value with the latest value
      cg.replace(latestValue);
      expect(cg.prices.length).toBe(5);
      expect(cg.getResultOrThrow().toFixed(4)).toBe(latestResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('indicates a downtrend when the center of gravity falls below the signal line', () => {
      const signalInterval = 10;
      const cg = new CG(5, signalInterval);
      const prices = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200] as const;
      for (const price of prices) {
        cg.add(price);
      }

      [150, 110, 90, 130].forEach(price => {
        cg.add(price);
      });

      expect(cg.isStable).toBe(true);
      expect(cg.getRequiredInputs()).toBe(signalInterval);

      const cgResult = cg.getResultOrThrow();
      const signalResult = cg.signal.getResultOrThrow();
      expect(cgResult > signalResult).toBe(false);
      expect(cgResult.toFixed(4)).toBe('2.7059');
      expect(cg.getResultOrThrow().toFixed(4)).toBe('2.7059');
    });

    it('throws an error when there is not enough input data', () => {
      const cg = new CG(10, 20);

      try {
        cg.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('is protected against division by zero errors', () => {
      const cg = new CG(1, 1);
      cg.add(0);
      expect(cg.getResultOrThrow()).toBe(0);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const cg = new CG(5, 10);
      const signal = cg.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns OVERBOUGHT when CG is above its signal line', () => {
      const cg = new CG(5, 10);
      const prices = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
      for (const price of prices) {
        cg.add(price);
      }
      const signal = cg.getSignal();
      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(cg.getResultOrThrow()).toBeGreaterThan(cg.signal.getResultOrThrow());
    });

    it('returns OVERSOLD when CG is below its signal line', () => {
      const cg = new CG(5, 10);
      const prices = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
      for (const price of prices) {
        cg.add(price);
      }
      // Now add declining prices to push CG below its signal line
      [150, 110, 90, 70, 50].forEach(price => {
        cg.add(price);
      });

      const signal = cg.getSignal();
      const cgValue = cg.getResultOrThrow();
      const signalValue = cg.signal.getResultOrThrow();

      expect(signal.state).toBe(TradingSignal.BEARISH);
      expect(cgValue).toBeLessThan(signalValue);
    });

    it('returns NEUTRAL when CG equals its signal line', () => {
      const cg = new CG(1, 1);
      cg.add(100);
      const signal = cg.getSignal();
      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
      expect(cg.getResultOrThrow()).toBe(cg.signal.getResultOrThrow());
    });
  });
});
