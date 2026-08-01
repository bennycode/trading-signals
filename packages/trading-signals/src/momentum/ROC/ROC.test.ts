import {ROC} from './ROC.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../base/Indicator.js';

describe('ROC', () => {
  describe('getResultOrThrow', () => {
    it('identifies an up-trending asset by a positive ROC', {tags: ['tulipindicators']}, () => {
      /*
       * Test data verified with:
       * https://tulipindicators.org/roc
       */
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;

      const expectations = [
        0.01911999019, 0.02195904268, 0.0135151442, 0.01867469879, 0.00897021887, 0.02862297053, 0.04466441332,
        0.03452791999, 0.03808397397, 0.03473210052,
      ] as const;

      const interval = 5;
      const roc = new ROC(interval);
      const offset = roc.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        roc.add(price);

        if (roc.isStable) {
          const expected = expectations[i - offset];
          expect(roc.getResultOrThrow().toFixed(2)).toEqual(expected?.toFixed(2));
        }
      });

      expect(roc.getRequiredInputs(), 'a comparison needs one bar more than the interval').toBe(interval + 1);
      expect(roc.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BULLISH,
      });
    });

    it('identifies a down-trending asset by a negative ROC', () => {
      const roc = new ROC(5);

      const prices = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100];

      prices.forEach(price => {
        roc.add(price);
      });

      expect(roc.getResultOrThrow().toFixed(2)).toBe('-0.83');
      expect(roc.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BEARISH,
      });
    });

    it('throws an error when there is not enough input data', () => {
      const roc = new ROC(6);

      try {
        roc.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('returns true when it can return reliable data', () => {
      const interval = 5;
      const indicator = new ROC(interval);
      expect(indicator.isStable).toBe(false);

      const mockedPrices = [0.0001904, 0.00019071, 0.00019198, 0.0001922, 0.00019214, 0.00019205];
      mockedPrices.forEach(price => indicator.add(price));
      expect(indicator.isStable).toBe(true);
    });

    it('becomes stable after exactly the number of inputs it reports as required', () => {
      const roc = new ROC(3);
      const required = roc.getRequiredInputs();

      for (let i = 1; i < required; i++) {
        roc.add(10 + i);
        expect(roc.isStable, `${i} of ${required} inputs is not enough`).toBe(false);
      }

      roc.add(20);

      expect(roc.isStable, 'the reported number of inputs produces a result').toBe(true);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const roc = new ROC(5);
      const signal = roc.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when ROC >= 0', () => {
      const roc = new ROC(5);
      const prices = [100, 101, 102, 103, 104, 105] as const;

      for (const price of prices) {
        roc.add(price);
      }

      const signal = roc.getSignal();

      expect(roc.getResultOrThrow()).toBeGreaterThanOrEqual(0);
      expect(signal.state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when ROC < 0', () => {
      const roc = new ROC(5);
      const prices = [105, 104, 103, 102, 101, 100] as const;

      for (const price of prices) {
        roc.add(price);
      }

      const signal = roc.getSignal();

      expect(roc.getResultOrThrow()).toBeLessThan(0);
      expect(signal.state).toBe(TradingSignal.BEARISH);
    });

    it('returns BULLISH when ROC = 0', () => {
      const roc = new ROC(5);
      const prices = [100, 100, 100, 100, 100, 100] as const;

      for (const price of prices) {
        roc.add(price);
      }

      const signal = roc.getSignal();

      expect(roc.getResultOrThrow()).toBe(0);
      expect(signal.state).toBe(TradingSignal.BULLISH);
    });
  });

  describe('update', () => {
    it('returns a valid result when replacing values', () => {
      const prices = [81.59, 81.06, 82.87, 83.0, 83.61, 83.15] as const;

      const roc = new ROC(5);

      prices.forEach(price => roc.add(price));

      const originalResult = roc.getResultOrThrow();
      const replacedResult = roc.replace(82.84);

      expect(replacedResult, 'a replacement recalculates against the same comparand').not.toBe(originalResult);

      const restoredResult = roc.replace(83.15);

      expect(restoredResult, 'replacing back restores the original result').toBe(originalResult);
    });

    it('changes nothing when the latest price is replaced with the same value', () => {
      const prices = [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84] as const;

      // Swept over every length because the comparand only goes wrong at the boundary.
      for (let length = 1; length <= prices.length; length++) {
        const roc = new ROC(5);

        prices.slice(0, length).forEach(price => roc.add(price));

        const resultBefore = roc.getResult();
        const stableBefore = roc.isStable;

        roc.replace(prices[length - 1]);

        expect(roc.getResult(), `replacing price ${length} with itself is a no-op`).toBe(resultBefore);
        expect(roc.isStable, `and does not change stability at ${length} prices`).toBe(stableBefore);
      }
    });

    it('stays unstable when replacing before the window is full', () => {
      const roc = new ROC(3);

      [10, 11, 12].forEach(price => roc.add(price));

      expect(roc.isStable, 'three prices do not fill a ROC(3) comparison window').toBe(false);
      expect(roc.replace(12.5), 'a replacement adds no bar, so there is still nothing to compare').toBeNull();
      expect(roc.isStable, 'a replacement must never make an unstable indicator stable').toBe(false);
    });

    it('keeps the correct comparand when replacing after the window has advanced', () => {
      const interval = 3;

      const withReplace = new ROC(interval);
      [10, 11, 12, 13].forEach(price => withReplace.add(price));
      withReplace.replace(13);

      const withoutReplace = new ROC(interval);
      [10, 11, 12, 13].forEach(price => withoutReplace.add(price));

      expect(withReplace.getResultOrThrow().toFixed(4)).toBe('0.3000');
      expect(withReplace.getResultOrThrow().toFixed(5)).toBe(withoutReplace.getResultOrThrow().toFixed(5));
    });
  });
});
