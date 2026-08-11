import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {NotEnoughDataError} from '../../error/index.js';
import {EMA} from '../EMA/EMA.js';
import {McGinleyDynamic} from './McGinleyDynamic.js';

describe('McGinleyDynamic', () => {
  /*
   * Test data verified with the McGinley Dynamic(14) baseline of "Skender.Stock.Indicators" v3.0.0,
   * which seeds the recursion with the first price and uses the published smoothing constant of 0.6.
   * Prices are the first 20 closes of its reference quote history:
   * https://github.com/DaveSkender/Stock.Indicators/blob/3.0.0/tests/indicators/_testdata/quotes/default.csv#L2-L21
   * Expectations are its committed baseline results, rounded to 7 decimal places:
   * https://github.com/DaveSkender/Stock.Indicators/blob/3.0.0/tests/indicators/_testdata/results/dynamic.standard.json#L54-L81
   */
  const prices = [
    212.8, 214.06, 213.89, 214.66, 213.95, 213.95, 214.55, 214.02, 214.51, 213.75, 214.22, 213.43, 214.21, 213.66,
    215.03, 216.89, 216.66, 216.32, 214.98, 214.96,
  ] as const;
  const expectations = [
    '213.7675128',
    '213.9143102',
    '214.2495145',
    '214.5239180',
    '214.7307240',
    '214.7602623',
    '214.7839523',
  ] as const;

  describe('replace', () => {
    it('re-seeds the average when the very first price is replaced', () => {
      const interval = 5;
      const md = new McGinleyDynamic(interval);
      const mdWithReplace = new McGinleyDynamic(interval);
      const firstPrice = prices[0];
      const remainingPrices = prices.slice(1);

      for (const price of prices) {
        md.add(price);
      }

      mdWithReplace.add(90210);
      mdWithReplace.replace(firstPrice);

      for (const price of remainingPrices) {
        mdWithReplace.add(price);
      }

      expect(mdWithReplace.getResultOrThrow()).toBe(md.getResultOrThrow());
    });

    it('replaces the most recently added value', () => {
      const md = new McGinleyDynamic(5);

      for (const price of [100, 110, 105, 90, 100] as const) {
        md.add(price);
      }

      const originalValue = 120;
      const replacedValue = 80;

      const originalResult = md.add(originalValue);

      expect(originalResult).toBe(100.08345697662284);

      const replacedResult = md.replace(replacedValue);

      expect(replacedResult).toBe(84.7939995580576);

      const restoredResult = md.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });

    it('will simply add prices when there are no prices to replace', () => {
      const md = new McGinleyDynamic(5);

      md.replace(100);
      md.add(110);
      md.add(105);
      md.add(90);
      md.add(100);

      expect(md.getResultOrThrow()).toBe(96.80902362839964);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Skender.Stock.Indicators', () => {
      const interval = 14;
      const md = new McGinleyDynamic(interval);
      const offset = md.getRequiredInputs() - 1;

      expect(md.getRequiredInputs()).toBe(interval);

      prices.forEach((price, i) => {
        const result = md.add(price);

        if (md.isStable && result) {
          expect(result.toFixed(7)).toBe(expectations[i - offset]);
        }
      });

      expect(md.getResultOrThrow().toFixed(7)).toBe('214.7839523');
    });

    it('follows the recursion of the published formula', () => {
      /*
       * Hand-derived: with an interval of 5 the tracking speed is 0.6 * 5 * ratio^4 = 3 * ratio^4,
       * where the ratio divides the incoming price by the previous reading. The first price seeds
       * the average:
       * MD1 = 100
       * MD2 = 100 + (110 - 100) / (3 * 1.1^4)                  = 100 + 10 / 4.3923...  = 102.2767115...
       * MD3 = MD2 + (105 - MD2) / (3 * (105 / MD2)^4)          = MD2 + 5 / 3.3325...   = 103.0938999...
       * MD4 = MD3 + (90 - MD3)  / (3 * (90 / MD3)^4)           = MD3 - 13.09 / 1.7424... = 95.5792353...
       * MD5 = MD4 + (100 - MD4) / (3 * (100 / MD4)^4)          = MD4 + 4.42 / 3.5947... = 96.8090236...
       */
      const md = new McGinleyDynamic(5);

      expect(md.add(100)).toBe(100);
      expect(md.add(110)).toBe(102.27671151788357);
      expect(md.add(105)).toBe(103.09389997105494);
      expect(md.add(90)).toBe(95.57923535777324);
      expect(md.add(100)).toBe(96.80902362839964);

      expect(md.getResultOrThrow()).toBe(96.80902362839964);
    });

    it('stays exactly on the price level when the market is completely flat', () => {
      const md = new McGinleyDynamic(5);

      for (let i = 0; i < 7; i++) {
        md.add(100);
      }

      expect(md.getResultOrThrow()).toBe(100);
    });

    it('tracks a sell-off faster and a rally slower than an EMA of the same interval', () => {
      /*
       * McGinley designed the tracking speed to be asymmetric: a price below the average shrinks
       * the ratio term, so the average races after sell-offs, while a price above the average
       * inflates it, so the average trails rallies. An EMA moves at the same speed in both
       * directions, which makes it the published benchmark for this behavior.
       */
      const interval = 14;
      const flatPrices = Array.from({length: interval}, () => 100);

      const mdDown = new McGinleyDynamic(interval);
      const emaDown = new EMA(interval);
      const mdUp = new McGinleyDynamic(interval);
      const emaUp = new EMA(interval);

      for (const price of flatPrices) {
        mdDown.add(price);
        emaDown.add(price);
        mdUp.add(price);
        emaUp.add(price);
      }

      mdDown.add(80);
      emaDown.add(80);

      expect(mdDown.getResultOrThrow()).toBe(94.18712797619048);
      expect(mdDown.getResultOrThrow()).toBeLessThan(emaDown.getResultOrThrow());

      mdUp.add(120);
      emaUp.add(120);

      expect(mdUp.getResultOrThrow()).toBe(101.14822163433274);
      expect(mdUp.getResultOrThrow()).toBeLessThan(emaUp.getResultOrThrow());
    });

    it('stays finite when every price is zero', () => {
      const md = new McGinleyDynamic(3);

      md.add(0);
      md.add(0);
      md.add(0);

      expect(md.getResultOrThrow()).toBe(0);
      expect(Number.isFinite(md.getResultOrThrow())).toBe(true);
    });

    it('pins the average at zero once the price level collapses to zero', () => {
      const md = new McGinleyDynamic(3);

      md.add(100);
      md.add(100);
      md.add(0);

      expect(md.getResultOrThrow()).toBe(0);

      md.add(50);

      expect(md.getResultOrThrow()).toBe(0);
    });

    it('throws an error during the warm-up period although the recursion emits from the first price', () => {
      const interval = 5;
      const md = new McGinleyDynamic(interval);

      for (const price of [100, 110, 105, 90] as const) {
        expect(md.add(price)).not.toBeNull();
        expect(md.isStable).toBe(false);
        expect(md.getResult()).toBeNull();
        expect(() => md.getResultOrThrow()).toThrow(NotEnoughDataError);
      }

      md.add(100);

      expect(md.isStable).toBe(true);
      expect(md.getResultOrThrow()).toBe(96.80902362839964);
    });
  });
});

testIndicatorContract({
  create: () => new McGinleyDynamic(5),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15],
});
