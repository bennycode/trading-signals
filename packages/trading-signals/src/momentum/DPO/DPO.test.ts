import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {DPO} from './DPO.js';
import {TradingSignal} from '../../base/Indicator.js';

describe('DPO', () => {
  describe('update', () => {
    it('replaces the most recently added value', () => {
      const prices = [81.59, 81.06, 82.87, 83.0, 83.61] as const;
      const dpo = new DPO(5);

      for (const price of prices) {
        dpo.add(price);
      }

      const originalValue = 83.15;
      const replacedValue = 90;

      dpo.add(originalValue);

      expect(dpo.getResultOrThrow().toFixed(3)).toBe('0.132');

      dpo.replace(replacedValue);

      expect(dpo.getResultOrThrow().toFixed(3)).toBe('-1.238');

      dpo.replace(originalValue);

      expect(dpo.getResultOrThrow().toFixed(3)).toBe('0.132');
    });
  });

  describe('getResultOrThrow', () => {
    it('detrends prices to expose the cycle', {tags: ['tulipindicators']}, () => {
      /*
       * Test data verified with:
       * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L162-L164
       */
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expectations = [
        '-1.366',
        '0.132',
        '-0.094',
        '0.292',
        '-0.478',
        '-0.938',
        '-0.264',
        '-0.444',
        '-1.214',
        '-0.688',
        '-0.264',
      ] as const;
      const dpo = new DPO(5);
      const offset = dpo.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = dpo.add(price);

        if (result !== null) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(dpo.isStable).toBe(true);
    });
  });

  describe('getRequiredInputs', () => {
    it('warms up over one full interval of 20 bars by default', () => {
      const dpo = new DPO();

      expect(dpo.getRequiredInputs()).toBe(20);
    });

    it('waits for the displaced close even after the average is ready', () => {
      const dpo = new DPO(2);

      expect(dpo.getRequiredInputs()).toBe(3);
      expect(dpo.add(10)).toBeNull();
      expect(dpo.add(20)).toBeNull();
      expect(dpo.add(30)).toBe(-15);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const dpo = new DPO(5);

      dpo.add(81.59);

      const signal = dpo.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });

    it('returns BULLISH when the cycle trades above the average', () => {
      const prices = [100, 90, 80, 70, 60] as const;
      const dpo = new DPO(5);

      for (const price of prices) {
        dpo.add(price);
      }

      expect(dpo.getResultOrThrow()).toBe(10);
      expect(dpo.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the cycle trades below the average', () => {
      const prices = [60, 70, 80, 90, 100] as const;
      const dpo = new DPO(5);

      for (const price of prices) {
        dpo.add(price);
      }

      expect(dpo.getResultOrThrow()).toBe(-10);
      expect(dpo.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the cycle sits exactly on the average', () => {
      const prices = [80, 80, 80, 80, 80] as const;
      const dpo = new DPO(5);

      for (const price of prices) {
        dpo.add(price);
      }

      expect(dpo.getResultOrThrow()).toBe(0);
      expect(dpo.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('tracks signal changes across zero crossings', () => {
      const prices = [100, 90, 80, 70, 60] as const;
      const dpo = new DPO(5);

      for (const price of prices) {
        dpo.add(price);
      }

      expect(dpo.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});

      dpo.add(60);

      expect(dpo.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});

      dpo.add(200);

      expect(dpo.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BEARISH});
    });
  });
});

testIndicatorContract({
  create: () => new DPO(5),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84],
});
