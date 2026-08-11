import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {NotEnoughDataError} from '../../error/index.js';
import {SuperSmoother} from './SuperSmoother.js';

describe('SuperSmoother', () => {
  /*
   * The SuperSmoother is not part of Tulip Indicators, so the reference values are hand-derived from
   * Ehlers' published EasyLanguage code (Code Listing 1 in
   * https://www.mesasoftware.com/papers/PredictiveIndicators.pdf, also printed in "Cycle Analytics
   * for Traders" (2013), Chapter 3) with interval N = 4:
   *
   *   angle = √2·π / N       = 1.1107207345395915
   *   a1 = e^(-angle)        = 0.32932152212461496
   *   b1 = 2·a1·cos(angle)   = 0.2924479447673371
   *   c2 = b1
   *   c3 = -a1²              = -0.10845266493447327
   *   c1 = 1 - c2 - c3       = 0.8160047201671361
   *
   *   Filt = c1·(Price + Price[1])/2 + c2·Filt[1] + c3·Filt[2], warm-started with Filt = Price on
   *   the first two bars ("if currentbar < 3 then Filt = Close").
   *
   * The coefficients are transcendental, so the decimals below come from a scratch script running
   * the very same arithmetic:
   *
   *   bar 1 (82): Filt = 82 (warm-start)
   *   bar 2 (88): Filt = 88 (warm-start)
   *   bar 3 (84): Filt = c1·(84 + 88)/2 + c2·88 + c3·82 = 87.0187
   *   bar 4 (90): Filt = c1·(90 + 84)/2 + c2·87.0187 + c3·88 = 86.8970
   *   bar 5 (86): Filt = c1·(86 + 90)/2 + c2·86.8970 + c3·87.0187 = 87.7839
   *   bar 6 (89): Filt = c1·(89 + 86)/2 + c2·87.7839 + c3·86.8970 = 87.6484
   *   bar 7 (87): Filt = c1·(87 + 89)/2 + c2·87.6484 + c3·87.7839 = 87.9206
   *
   * Results become visible once the interval is filled, so the expectations start at bar 4.
   */
  const prices = [82, 88, 84, 90, 86, 89, 87] as const;
  const expectations = ['86.8970', '87.7839', '87.6484', '87.9206'] as const;

  describe('getResultOrThrow', () => {
    it('calculates the SuperSmoother filter over a period of 4', () => {
      const interval = 4;
      const superSmoother = new SuperSmoother(interval);
      const offset = superSmoother.getRequiredInputs() - 1;

      expect(superSmoother.getRequiredInputs()).toBe(interval);

      prices.forEach((price, i) => {
        superSmoother.add(price);

        if (superSmoother.isStable) {
          expect(superSmoother.getResultOrThrow().toFixed(4)).toBe(expectations[i - offset]);
        }
      });

      expect(superSmoother.isStable).toBe(true);
    });

    it('produces the exact doubles of a reference recursion built from the same coefficients', () => {
      const interval = 4;
      const angle = (Math.SQRT2 * Math.PI) / interval;
      const a1 = Math.exp(-angle);
      const c2 = 2 * a1 * Math.cos(angle);
      const c3 = -a1 * a1;
      const c1 = 1 - c2 - c3;
      const superSmoother = new SuperSmoother(interval);

      let previousPrice: number | undefined;
      let previousFilter: number | undefined;
      let secondPreviousFilter: number | undefined;

      for (const price of prices) {
        const expected =
          previousPrice === undefined || previousFilter === undefined || secondPreviousFilter === undefined
            ? price
            : c1 * ((price + previousPrice) / 2) + c2 * previousFilter + c3 * secondPreviousFilter;

        expect(superSmoother.add(price)).toBe(expected);

        secondPreviousFilter = previousFilter;
        previousFilter = expected;
        previousPrice = price;
      }
    });

    it('throws before the interval is filled, although the recursion already runs from the third bar', () => {
      const superSmoother = new SuperSmoother(5);

      for (const price of [82, 88, 84, 90] as const) {
        superSmoother.add(price);
      }

      expect(superSmoother.isStable).toBe(false);
      expect(() => superSmoother.getResultOrThrow()).toThrow(NotEnoughDataError);

      superSmoother.add(86);

      expect(superSmoother.isStable).toBe(true);
      expect(superSmoother.getResult()).not.toBeNull();
    });

    it('derives filter coefficients that sum to one', () => {
      const intervals = [2, 4, 10, 50, 200] as const;

      intervals.forEach(interval => {
        const angle = (Math.SQRT2 * Math.PI) / interval;
        const a1 = Math.exp(-angle);
        const c2 = 2 * a1 * Math.cos(angle);
        const c3 = -a1 * a1;
        const c1 = 1 - c2 - c3;

        /*
         * c1 is defined as the complement of c2 and c3, so the sum can only be off by the single
         * rounding step of re-adding what was subtracted — never more than one ulp around 1.
         */
        expect(c1 + c2 + c3).toBeCloseTo(1, 15);
      });
    });

    it('converges to the constant when the market is completely flat', () => {
      const superSmoother = new SuperSmoother(10);

      for (let i = 0; i < 100; i++) {
        superSmoother.add(123.45);
      }

      /*
       * The filter weights sum to one within one ulp, so a flat series is a fixed point of the
       * recursion up to floating-point rounding. 100 bars accumulate an error many orders of
       * magnitude below the asserted nanometer-scale tolerance.
       */
      expect(superSmoother.getResultOrThrow()).toBeCloseTo(123.45, 9);
    });

    it('cancels a two-bar wave down to its midline', () => {
      const superSmoother = new SuperSmoother(10);

      for (let i = 0; i < 60; i++) {
        superSmoother.add(i % 2 === 0 ? 105 : 95);
      }

      /*
       * Averaging two adjacent prices zeroes out a wave that flips direction on every bar — the
       * aliasing noise the SuperSmoother is designed to remove. Only the decaying imprint of the
       * raw-price warm-start keeps the reading a hair away from the midline.
       */
      expect(superSmoother.getResultOrThrow()).toBeCloseTo(100, 7);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const superSmoother = new SuperSmoother(4);

      for (const price of prices) {
        superSmoother.add(price);
      }

      const originalValue = 95;
      const replacedValue = 80;

      const originalResult = superSmoother.add(originalValue);

      expect(originalResult?.toFixed(4)).toBe('90.4629');

      const replacedResult = superSmoother.replace(replacedValue);

      expect(replacedResult?.toFixed(4)).toBe('84.3429');

      const restoredResult = superSmoother.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });

    it('recovers the exact add-only series when more prices follow a replacement', () => {
      const lastPrice = prices[prices.length - 1];
      const addOnly = new SuperSmoother(4);
      const withReplace = new SuperSmoother(4);

      for (const price of prices.slice(0, -1)) {
        addOnly.add(price);
        withReplace.add(price);
      }

      addOnly.add(lastPrice);
      withReplace.add(1_000);
      withReplace.replace(lastPrice);

      /*
       * The recursion carries the previous price and two prior readings across bars, so a stale
       * leftover from the replaced price would surface within the next three additions.
       */
      for (const price of [91, 85, 93] as const) {
        expect(withReplace.add(price)).toBe(addOnly.add(price));
      }
    });

    it('re-seeds the filter when the very first price is replaced', () => {
      const addOnly = new SuperSmoother(4);
      const withReplace = new SuperSmoother(4);

      for (const price of prices) {
        addOnly.add(price);
      }

      withReplace.add(90_210);
      withReplace.replace(prices[0]);

      for (const price of prices.slice(1)) {
        withReplace.add(price);
      }

      expect(withReplace.getResultOrThrow()).toBe(addOnly.getResultOrThrow());
    });

    it('simply adds the price when there is nothing to replace yet', () => {
      const superSmoother = new SuperSmoother(4);

      superSmoother.replace(prices[0]);

      for (const price of prices.slice(1, 4)) {
        superSmoother.add(price);
      }

      expect(superSmoother.getResultOrThrow().toFixed(4)).toBe('86.8970');
    });
  });
});

testIndicatorContract({
  create: () => new SuperSmoother(4),
  divergentInput: 1_000,
  inputs: [82, 88, 84, 90, 86, 89],
});
