import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {TSI} from './TSI.js';
import {TradingSignal} from '../../base/index.js';

describe('TSI', () => {
  describe('update', () => {
    it('double-smooths momentum into a strength reading bounded by -100 and +100', () => {
      /*
       * Hand-derived reference values for William Blau's formula
       * TSI = 100 * EMA(short, EMA(long, m)) / EMA(short, EMA(long, |m|)) with m = price - previousPrice:
       * https://en.wikipedia.org/wiki/True_strength_index
       *
       * Committed baselines of other libraries (e.g. Skender.Stock.Indicators) seed their EMAs with an SMA
       * while this library seeds with the first input, so their early readings cannot be reproduced here
       * and the expectations are derived by hand instead. Smoothing weights: EMA(3) w=1/2, EMA(2) w=2/3.
       * The short EMAs start once the long EMAs are warmed up, i.e. from the 3rd momentum value.
       *
       * price |  m | |m| | EMA3(m) | EMA3(|m|) | EMA2(EMA3(m)) | EMA2(EMA3(|m|)) | TSI
       *    10 |  - |  -  |    -    |     -     |       -       |        -        |  -
       *    11 |  1 |  1  |    1    |     1     |       -       |        -        |  -
       *    13 |  2 |  2  |   3/2   |    3/2    |       -       |        -        |  -
       *    12 | -1 |  1  |   1/4   |    5/4    |      1/4      |       5/4       |  -
       *    14 |  2 |  2  |   9/8   |   13/8    |      5/6      |       3/2       | 100*(5/6)/(3/2) = 55.56
       *    16 |  2 |  2  |  25/16  |   29/16   |     95/72     |      41/24      | 100*(95/72)/(41/24) = 77.24
       *    15 | -1 |  1  |   9/32  |   45/32   |    271/432    |     217/144     | 100*(271/432)/(217/144) = 41.63
       */
      const prices = [10, 11, 13, 12, 14, 16, 15] as const;
      const expectations = ['55.56', '77.24', '41.63'] as const;
      const tsi = new TSI({longPeriod: 3, shortPeriod: 2});
      const offset = tsi.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = tsi.add(price);

        if (result !== null) {
          expect(result.toFixed(2)).toBe(expectations[i - offset]);
        }
      });

      expect(tsi.isStable).toBe(true);
    });

    it('reports exactly 100 when every candle in memory closed higher', () => {
      const prices = [1, 2, 4, 8, 16, 32, 64] as const;
      const tsi = new TSI({longPeriod: 3, shortPeriod: 2});

      for (const price of prices) {
        const result = tsi.add(price);

        if (result !== null) {
          expect(result).toBe(100);
        }
      }

      expect(tsi.isStable).toBe(true);
    });

    it('reports exactly -100 when every candle in memory closed lower', () => {
      const prices = [64, 32, 16, 8, 4, 2, 1] as const;
      const tsi = new TSI({longPeriod: 3, shortPeriod: 2});

      for (const price of prices) {
        const result = tsi.add(price);

        if (result !== null) {
          expect(result).toBe(-100);
        }
      }

      expect(tsi.isStable).toBe(true);
    });

    it('reports 0 for a perfectly flat market instead of dividing zero by zero', () => {
      const tsi = new TSI({longPeriod: 3, shortPeriod: 2});

      for (let i = 0; i < 5; i++) {
        tsi.add(100);
      }

      expect(tsi.getResultOrThrow()).toBe(0);
    });
  });

  describe('constructor', () => {
    it("uses William Blau's canonical periods of 25 and 13 by default", () => {
      const tsi = new TSI();

      expect(tsi.longPeriod).toBe(25);
      expect(tsi.shortPeriod).toBe(13);

      for (let i = 1; i < tsi.getRequiredInputs(); i++) {
        expect(tsi.add(i)).toBeNull();
      }

      expect(tsi.add(38)).toBe(100);
    });
  });

  describe('getRequiredInputs', () => {
    it('needs the long momentum smoothing plus the short re-smoothing to warm up', () => {
      expect(new TSI().getRequiredInputs()).toBe(38);
      expect(new TSI({longPeriod: 3, shortPeriod: 2}).getRequiredInputs()).toBe(5);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const prices = [10, 11, 13, 12, 14, 16, 15] as const;
      const tsi = new TSI({longPeriod: 3, shortPeriod: 2});

      for (const price of prices) {
        tsi.add(price);
      }

      const originalValue = 20;
      const replacedValue = 10;

      const originalResult = tsi.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('74.67');

      const replacedResult = tsi.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('-51.70');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = tsi.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN while the indicator is warming up', () => {
      const tsi = new TSI({longPeriod: 3, shortPeriod: 2});

      expect(tsi.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });

      tsi.add(10);
      tsi.add(11);

      expect(tsi.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when buyers dominate', () => {
      const prices = [10, 11, 12, 13, 14, 15] as const;
      const tsi = new TSI({longPeriod: 3, shortPeriod: 2});

      for (const price of prices) {
        tsi.add(price);
      }

      expect(tsi.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BULLISH,
      });
    });

    it('returns BEARISH when sellers dominate', () => {
      const prices = [64, 32, 16, 8, 4, 2] as const;
      const tsi = new TSI({longPeriod: 3, shortPeriod: 2});

      for (const price of prices) {
        tsi.add(price);
      }

      expect(tsi.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BEARISH,
      });
    });

    it('returns SIDEWAYS when a flat market shows no strength in either direction', () => {
      const tsi = new TSI({longPeriod: 3, shortPeriod: 2});

      for (let i = 0; i < 6; i++) {
        tsi.add(100);
      }

      expect(tsi.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.SIDEWAYS,
      });
    });

    it('flags the change when momentum flips from BULLISH to BEARISH', () => {
      const prices = [10, 11, 12, 13, 14, 15] as const;
      const tsi = new TSI({longPeriod: 3, shortPeriod: 2});

      for (const price of prices) {
        tsi.add(price);
      }

      expect(tsi.getSignal().state).toBe(TradingSignal.BULLISH);

      tsi.add(2);

      expect(tsi.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });
  });
});

testIndicatorContract({
  create: () => new TSI({longPeriod: 5, shortPeriod: 2}),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84],
});
