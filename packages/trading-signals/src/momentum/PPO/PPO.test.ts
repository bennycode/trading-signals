import {PPO} from './PPO.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../base/index.js';

describe('PPO', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L313-L315
   *
   * Tulip emits results from the 2nd candle onward; this implementation waits until the slow
   * EMA is stable, so the first three Tulip values are skipped and the remaining ones match.
   */
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = [
    '0.747',
    '0.424',
    '0.134',
    '0.500',
    '0.691',
    '0.503',
    '0.810',
    '1.088',
    '1.040',
    '1.133',
    '0.716',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const ppo = new PPO({fastPeriod: 2, slowPeriod: 5});

      ppo.updates(prices, false);

      const originalValue = 90;
      const replacedValue = 83;

      const originalResult = ppo.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('1.49');

      const replacedResult = ppo.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('-1.20');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = ppo.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const ppo = new PPO({fastPeriod: 2, slowPeriod: 5});
      const offset = ppo.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = ppo.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(ppo.isStable).toBe(true);
      expect(ppo.getRequiredInputs()).toBe(5);
    });

    it('throws an error when there is not enough input data', () => {
      const ppo = new PPO();

      try {
        ppo.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const ppo = new PPO();

      expect(ppo.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when the fast EMA is above the slow EMA', () => {
      const ppo = new PPO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 6; i++) {
        ppo.add(100 + i);
      }

      expect(ppo.getResultOrThrow()).toBeGreaterThan(0);
      expect(ppo.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the fast EMA is below the slow EMA', () => {
      const ppo = new PPO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 6; i++) {
        ppo.add(100 - i);
      }

      expect(ppo.getResultOrThrow()).toBeLessThan(0);
      expect(ppo.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the fast and slow EMA are equal', () => {
      const ppo = new PPO({fastPeriod: 2, slowPeriod: 5});

      for (let i = 0; i < 6; i++) {
        ppo.add(100);
      }

      expect(ppo.getResultOrThrow()).toBe(0);
      expect(ppo.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });
});
