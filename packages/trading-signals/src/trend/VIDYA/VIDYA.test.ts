import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {EMA} from '../EMA/EMA.js';
import {VIDYA} from './VIDYA.js';

describe('VIDYA', () => {
  /*
   * No published fixture exists for this VIDYA variant with first-price seeding: Tulip Indicators
   * (https://tulipindicators.org/vidya) implements Chande's older 1992 standard-deviation variant, and pandas-ta
   * seeds its CMO-based recursion with zero, which skews all early values. The expectations below are therefore
   * derived by hand from the CMO-based definition
   * (https://www.metatrader5.com/en/terminal/help/indicators/trend_indicators/vida) with alpha = 2 / (2 + 1) = 2/3
   * and the seed being the first price (10):
   *
   * Price 11: changes +2 / -1 over (10, 12, 11) => CMO = 100 * (2 - 1) / 3 = 33.33 => k = 1/3
   *           VIDYA = (2/3 * 1/3) * 11 + (1 - 2/9) * 10      = 92/9   = 10.2222
   * Price 14: changes -1 / +3 over (12, 11, 14) => CMO = 100 * (3 - 1) / 4 = 50    => k = 1/2
   *           VIDYA = (2/3 * 1/2) * 14 + (1 - 1/3) * 92/9    = 310/27 = 11.4815
   * Price 13: changes +3 / -1 over (11, 14, 13) => CMO = 100 * (3 - 1) / 4 = 50    => k = 1/2
   *           VIDYA = (2/3 * 1/2) * 13 + (1 - 1/3) * 310/27  = 971/81 = 11.9877
   */
  const prices = [10, 12, 11, 14, 13] as const;
  const expectations = ['10.2222', '11.4815', '11.9877'] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const vidya = new VIDYA(2);

      vidya.updates([10, 12, 11, 14], false);

      const originalValue = 13;
      const replacedValue = 8;

      const originalResult = vidya.add(originalValue);

      expect(originalResult?.toFixed(4)).toBe('11.9877');

      /*
       * The replacement flips the momentum reading: changes +3 / -6 over (11, 14, 8) give
       * CMO = 100 * (3 - 6) / 9 = -33.33 => k = 1/3, and the recursion resumes from the result
       * before the replaced price (310/27):
       * VIDYA = (2/3 * 1/3) * 8 + (1 - 2/9) * 310/27 = 2602/243 = 10.7078
       */
      const replacedResult = vidya.replace(replacedValue);

      expect(replacedResult?.toFixed(4)).toBe('10.7078');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = vidya.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });

    it('treats a replacement before any values as the first value', () => {
      const vidya = new VIDYA(2);

      expect(vidya.replace(10)).toBeNull();
      expect(vidya.add(12)).toBeNull();
      expect(vidya.add(11)?.toFixed(4)).toBe('10.2222');
    });

    it('re-seeds when the very first price is replaced', () => {
      const reference = new VIDYA(2);

      reference.updates([9, 12, 11], false);

      const vidya = new VIDYA(2);

      vidya.add(10);
      vidya.replace(9);
      vidya.add(12);
      vidya.add(11);

      expect(vidya.getResultOrThrow()).toBe(reference.getResultOrThrow());
      expect(vidya.getResultOrThrow().toFixed(4)).toBe('9.6667');
    });
  });

  describe('getResultOrThrow', () => {
    it('matches a hand-derived reference series', () => {
      const interval = 2;
      const vidya = new VIDYA(interval);
      const offset = vidya.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = vidya.add(price);

        if (result) {
          expect(result.toFixed(4)).toBe(expectations[i - offset]);
        }
      });

      expect(vidya.isStable).toBe(true);
      expect(vidya.getRequiredInputs()).toBe(interval + 1);
    });

    it('stays on the price level when the market is completely flat', () => {
      const vidya = new VIDYA(5);

      for (let i = 0; i < 8; i++) {
        vidya.add(100);
      }

      expect(vidya.getResultOrThrow()).toBe(100);
    });

    it('matches a plain EMA when every bar moves in the same direction', () => {
      /*
       * On a strictly rising series the absolute CMO is pinned at 100, so the adaptive weight collapses to the
       * plain EMA weight. The EMA twin seeds on the first price — exactly like VIDYA — and afterwards only sees
       * the prices for which VIDYA produces results.
       */
      const risingPrices = [10, 11, 13, 16, 20, 21, 23, 26, 30, 31] as const;
      const vidya = new VIDYA(3);
      const ema = new EMA(3);
      const offset = vidya.getRequiredInputs() - 1;

      ema.add(risingPrices[0]);

      risingPrices.forEach((price, i) => {
        const result = vidya.add(price);

        if (i >= offset) {
          expect(result).toBe(ema.add(price));
        }
      });

      expect(vidya.isStable).toBe(true);
    });
  });
});

testIndicatorContract({
  create: () => new VIDYA(5),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15],
});
