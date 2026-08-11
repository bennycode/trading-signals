import {NotEnoughDataError} from '../../error/index.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {EMA} from '../EMA/EMA.js';
import {ZLEMA} from './ZLEMA.js';

describe('ZLEMA', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L497-L499
   */
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expectations = [
    '83.477',
    '83.418',
    '82.969',
    '83.589',
    '84.479',
    '84.563',
    '85.212',
    '86.381',
    '87.004',
    '87.669',
    '87.676',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const zlema = new ZLEMA(5);

      zlema.updates(prices, false);

      const originalValue = 90;
      const replacedValue = 80;

      const originalResult = zlema.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('89.19');

      const replacedResult = zlema.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('82.53');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = zlema.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });

    it('simply adds a price when there is no price to replace', () => {
      const zlema = new ZLEMA(5);

      zlema.replace(prices[0]);

      for (const price of prices.slice(1, 5)) {
        zlema.add(price);
      }

      expect(zlema.getResultOrThrow().toFixed(3)).toBe('83.477');
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const interval = 5;
      const zlema = new ZLEMA(interval);
      const offset = zlema.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = zlema.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(zlema.isStable).toBe(true);
      expect(zlema.getRequiredInputs()).toBe(interval);
    });

    it('throws an error when the smoothing has started but the interval is not yet filled', () => {
      const zlema = new ZLEMA(5);

      zlema.add(prices[0]);
      zlema.add(prices[1]);

      expect(zlema.isStable).toBe(false);
      expect(() => zlema.getResultOrThrow()).toThrow(NotEnoughDataError);
    });

    it('tracks the price itself when the interval is 1', () => {
      const zlema = new ZLEMA(1);

      expect(zlema.add(81.59)?.toFixed(2)).toBe('81.59');
      expect(zlema.add(82.87)?.toFixed(2)).toBe('82.87');
      expect(zlema.getResultOrThrow().toFixed(2)).toBe('82.87');
    });

    it('tracks a steadily trending price more closely than a classic EMA', () => {
      const interval = 5;
      const zlema = new ZLEMA(interval);
      const ema = new EMA(interval);

      let price = 100;

      for (let i = 0; i < 20; i++) {
        price += 1;
        zlema.add(price);
        ema.add(price);
      }

      const zlemaLag = price - zlema.getResultOrThrow();
      const emaLag = price - ema.getResultOrThrow();

      expect(zlemaLag).toBeLessThan(emaLag);
    });
  });
});

testIndicatorContract({
  create: () => new ZLEMA(5),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15],
});
