import {VROC} from './VROC.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../types/index.js';

describe('VROC', () => {
  describe('getResultOrThrow', () => {
    it('calculates the Volume Rate of Change', () => {
      // VROC(3) needs 4 data points (interval + 1)
      // VROC = ((current - prev_n) / prev_n) * 100
      // After [1000, 1500, 2000, 2500]: (2500-1000)/1000*100 = 150
      // After [1500, 2000, 2500, 3000]: (3000-1500)/1500*100 = 100
      // After [2000, 2500, 3000, 2000]: (2000-2000)/2000*100 = 0
      const volumes = [1000, 1500, 2000, 2500, 3000, 2000] as const;
      const expectations = ['150.00', '100.00', '0.00'] as const;
      const vroc = new VROC(3);
      const offset = vroc.getRequiredInputs() - 1;

      volumes.forEach((volume, i) => {
        vroc.add(volume);

        if (vroc.isStable) {
          const expected = expectations[i - offset];
          expect(vroc.getResultOrThrow().toFixed(2)).toBe(expected);
        }
      });

      expect(vroc.isStable).toBe(true);
      expect(vroc.getRequiredInputs()).toBe(4);
    });

    it('throws an error when there is not enough input data', () => {
      const vroc = new VROC(5);
      expect(vroc.isStable).toBe(false);

      try {
        vroc.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('returns 0 when previous volume is 0', () => {
      const vroc = new VROC(2);
      vroc.add(0);
      vroc.add(100);
      vroc.add(200);

      expect(vroc.getResultOrThrow()).toBe(0);
    });
  });

  describe('isStable', () => {
    it('returns true when enough data has been provided', () => {
      const vroc = new VROC(3);
      expect(vroc.isStable).toBe(false);

      vroc.add(100);
      vroc.add(200);
      vroc.add(300);
      expect(vroc.isStable).toBe(false);

      vroc.add(400);
      expect(vroc.isStable).toBe(true);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const vroc = new VROC(5);
      const signal = vroc.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when VROC is positive', () => {
      const vroc = new VROC(2);
      const volumes = [100, 200, 300] as const;

      for (const volume of volumes) {
        vroc.add(volume);
      }

      expect(vroc.getResultOrThrow()).toBeGreaterThan(0);
      expect(vroc.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns SIDEWAYS when VROC is zero', () => {
      const vroc = new VROC(2);
      const volumes = [100, 200, 100] as const;

      for (const volume of volumes) {
        vroc.add(volume);
      }

      expect(vroc.getResultOrThrow()).toBe(0);
      expect(vroc.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('returns BEARISH when VROC is negative', () => {
      const vroc = new VROC(2);
      const volumes = [300, 200, 100] as const;

      for (const volume of volumes) {
        vroc.add(volume);
      }

      expect(vroc.getResultOrThrow()).toBeLessThan(0);
      expect(vroc.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const vroc = new VROC(3);
      vroc.add(100);
      vroc.add(200);
      vroc.add(300);

      const originalResult = vroc.add(500);
      const replacedResult = vroc.replace(150);

      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = vroc.replace(500);

      expect(restoredResult).toBe(originalResult);
    });
  });
});
