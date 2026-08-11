import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {FRAMA} from './FRAMA.js';

describe('FRAMA', () => {
  /*
   * FRAMA is not part of Tulip Indicators, so the reference values are hand-derived from the formulas in
   * Ehlers' paper (http://www.mesasoftware.com/papers/FRAMA.pdf) with interval N = 4 (window halves of 2):
   *
   * Prices 82, 88, 84 fill the window; price 90 completes it and seeds FRAMA = 90.
   *
   * Price 86 — window [88, 84, 90, 86]:
   *   N1 = (88 - 84) / 2 = 2 (older half), N2 = (90 - 86) / 2 = 2 (newer half), N3 = (90 - 84) / 4 = 1.5
   *   D = (ln(2 + 2) - ln(1.5)) / ln(2) = 1.415037
   *   alpha = exp(-4.6 * (D - 1)) = 0.148203
   *   FRAMA = 0.148203 * 86 + 0.851797 * 90 = 89.407
   *
   * Price 89 — window [84, 90, 86, 89]:
   *   N1 = (90 - 84) / 2 = 3, N2 = (89 - 86) / 2 = 1.5, N3 = (90 - 84) / 4 = 1.5
   *   D = (ln(4.5) - ln(1.5)) / ln(2) = ln(3) / ln(2) = 1.584963
   *   alpha = exp(-4.6 * 0.584963) = 0.067825
   *   FRAMA = 0.067825 * 89 + 0.932175 * 89.407188 = 89.380
   *
   * Price 87 — window [90, 86, 89, 87]:
   *   N1 = (90 - 86) / 2 = 2, N2 = (89 - 87) / 2 = 1, N3 = (90 - 86) / 4 = 1
   *   D = (ln(3) - ln(1)) / ln(2) = 1.584963
   *   alpha = 0.067825
   *   FRAMA = 0.067825 * 87 + 0.932175 * 89.379571 = 89.218
   */
  const prices = [82, 88, 84, 90, 86, 89, 87] as const;
  const expectations = ['90.000', '89.407', '89.380', '89.218'] as const;

  describe('constructor', () => {
    it('throws when the interval is odd, because the fractal dimension is measured over two equal window halves', () => {
      expect(() => new FRAMA(5)).toThrowError(
        'The interval has to be an even number of at least 2, but "5" was given.'
      );
    });

    it('throws when the interval is smaller than 2', () => {
      expect(() => new FRAMA(0)).toThrowError(
        'The interval has to be an even number of at least 2, but "0" was given.'
      );
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const frama = new FRAMA(4);

      frama.updates(prices, false);

      const originalValue = 95;
      const replacedValue = 80;

      const originalResult = frama.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('90.74');

      const replacedResult = frama.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('84.64');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = frama.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('matches the reference calculation hand-derived from the Ehlers paper', () => {
      const interval = 4;
      const frama = new FRAMA(interval);
      const offset = frama.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = frama.add(price);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(frama.isStable).toBe(true);
      expect(frama.getRequiredInputs()).toBe(interval);
    });

    it('stays on the price level when the market is completely flat', () => {
      const frama = new FRAMA(4);

      for (let i = 0; i < 8; i++) {
        frama.add(100);
      }

      expect(frama.getResultOrThrow()).toBe(100);
    });

    it('snaps to the latest price when only the older window half is flat', () => {
      const frama = new FRAMA(4);

      frama.updates([50, 50, 50, 60, 70], false);

      expect(frama.getResultOrThrow()).toBe(70);
    });

    it('snaps to the latest price when only the newer window half is flat', () => {
      const frama = new FRAMA(4);

      frama.updates([40, 60, 70, 50, 50], false);

      expect(frama.getResultOrThrow()).toBe(50);
    });

    it('clamps the smoothing at the latest price when the window is wildly volatile', () => {
      /*
       * The final window [10, 11, 100, 101] gapped up between its halves:
       * N1 = 0.5, N2 = 0.5, N3 = 22.75 make D = -4.507795, so the raw smoothing
       * exp(-4.6 * (D - 1)) = 1.007e11 hits the upper bound of 1.
       */
      const frama = new FRAMA(4);

      frama.updates([10, 11, 10, 11, 100], false);

      expect(frama.getResultOrThrow()).not.toBe(101);
      expect(frama.add(101)).toBe(101);
    });
  });
});

testIndicatorContract({
  create: () => new FRAMA(4),
  divergentInput: 1_000,
  inputs: [82, 88, 84, 90, 86, 89],
});
