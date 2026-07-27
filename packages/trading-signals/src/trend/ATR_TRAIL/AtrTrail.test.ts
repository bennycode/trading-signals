import {AtrTrail, AtrTrailMode} from './AtrTrail.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('AtrTrail', () => {
  /*
   * Five identical candles with a steady true range of 10 around a close of 100 warm the
   * Wilder-smoothed ATR(5) up to exactly 10, i.e. an ATR% of 10. With a multiplier of 2 the
   * trail width is therefore 20% and the first stop hangs 20% below the peak of 105.
   */
  const warmupCandles = [
    {close: 100, high: 105, low: 95},
    {close: 100, high: 105, low: 95},
    {close: 100, high: 105, low: 95},
    {close: 100, high: 105, low: 95},
    {close: 100, high: 105, low: 95},
  ] as const;

  const followUpCandles = [
    {close: 195, high: 200, low: 190},
    {close: 245, high: 250, low: 240},
    {close: 150, high: 240, low: 140},
  ] as const;

  describe('getResultOrThrow', () => {
    it('freezes the trail width at warm-up and trails a ratcheting peak', () => {
      const candles = [...warmupCandles, ...followUpCandles] as const;
      /*
       * The width stays 20% although the last candle's volatility explodes, and the peak of 250
       * never falls back although the last candle prints far below it.
       */
      const expectations = ['84.00', '160.00', '200.00', '200.00'] as const;
      const trail = new AtrTrail({interval: 5, multiplier: 2});
      const offset = trail.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = trail.add(candle);

        if (result) {
          expect(result.toFixed(2)).toBe(expectations[i - offset]);
        }
      });

      expect(trail.isStable).toBe(true);
      expect(trail.getRequiredInputs()).toBe(5);
    });

    it('re-sizes the trail from the live ATR in ROLLING mode without loosening the stop', () => {
      const candles = [...warmupCandles, ...followUpCandles] as const;
      /*
       * The width widens as the ATR picks up, but the volatility spike of the last candle only
       * lowers the candidate stop — the emitted stop never decreases.
       */
      const expectations = ['84.00', '142.56', '181.84', '181.84'] as const;
      const trail = new AtrTrail({interval: 5, mode: AtrTrailMode.ROLLING, multiplier: 2});
      const offset = trail.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = trail.add(candle);

        if (result) {
          expect(result.toFixed(2)).toBe(expectations[i - offset]);
        }
      });

      expect(trail.isStable).toBe(true);
    });

    it('gives a volatile instrument a wider trail than a calm one', () => {
      const volatile = new AtrTrail({interval: 5, multiplier: 2});
      const calm = new AtrTrail({interval: 5, multiplier: 2});

      for (const candle of warmupCandles) {
        volatile.add(candle);
        calm.add({close: 100, high: 100.5, low: 99.5});
      }

      // Volatile: 10% ATR -> stop 20% below the peak of 105. Calm: 1% ATR -> stop 2% below 100.5.
      expect(volatile.getResultOrThrow().toFixed(2)).toBe('84.00');
      expect(calm.getResultOrThrow().toFixed(2)).toBe('98.49');
    });

    it('uses an interval of 14, a multiplier of 3 and the FROZEN mode by default', () => {
      const trail = new AtrTrail();

      expect(trail.getRequiredInputs()).toBe(14);
      expect(trail.interval).toBe(14);
      expect(trail.mode).toBe(AtrTrailMode.FROZEN);
      expect(trail.multiplier).toBe(3);
    });

    it('throws an error when there is not enough input data', () => {
      const trail = new AtrTrail({interval: 5, multiplier: 2});

      try {
        trail.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value in FROZEN mode', () => {
      const trail = new AtrTrail({interval: 5, multiplier: 2});

      trail.updates(warmupCandles, false);

      const originalValue = {close: 195, high: 200, low: 190} as const;
      const replacedValue = {close: 100, high: 110, low: 90} as const;

      const originalResult = trail.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('160.00');

      const replacedResult = trail.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('88.00');

      const restoredResult = trail.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });

    it('replaces the most recently added value in ROLLING mode', () => {
      const trail = new AtrTrail({interval: 5, mode: AtrTrailMode.ROLLING, multiplier: 2});

      trail.updates(warmupCandles, false);

      const originalValue = {close: 195, high: 200, low: 190} as const;
      const replacedValue = {close: 100, high: 110, low: 90} as const;

      const originalResult = trail.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('142.56');

      /*
       * The replaced candle's stop candidate (83.60) sits below the already committed stop of
       * 84.00, so the ratchet keeps the prior stop in place.
       */
      const replacedResult = trail.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('84.00');

      const restoredResult = trail.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });
});
