import {TradingSignal} from '../../base/index.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {LaguerreRSI} from './LaguerreRSI.js';

describe('LaguerreRSI', () => {
  /*
   * There is no Tulip Indicators entry for the Laguerre RSI, so the expectations are hand-derived
   * from the code John Ehlers published in "Cybernetic Analysis for Stocks and Futures" (2004),
   * chapter 14: L0 = (1 - g) * price + g * L0[1], L1 = -g * L0 + L0[1] + g * L1[1],
   * L2 = -g * L1 + L1[1] + g * L2[1], L3 = -g * L2 + L2[1] + g * L3[1]; every positive gap
   * between adjacent stages adds to CU, every negative one to CD; LRSI = CU / (CU + CD).
   * With gamma = 0.5 every stage value is a dyadic fraction, so IEEE doubles carry each step
   * exactly and the assertions can be exact (verified with exact rational arithmetic):
   *
   * | Bar | Price | L0   | L1    | L2    | L3     | CU     | CD   | LRSI      |
   * | --- | ----- | ---- | ----- | ----- | ------ | ------ | ---- | --------- |
   * | 1   | 8     | 4    | -2    | 1     | -1/2   | 15/2   | 3    | (warm-up) |
   * | 2   | 4     | 4    | 1     | -2    | 7/4    | 6      | 15/4 | (warm-up) |
   * | 3   | 6     | 5    | 2     | -1    | -5/8   | 6      | 3/8  | (warm-up) |
   * | 4   | 2     | 7/2  | 17/4  | -5/8  | -1     | 21/4   | 3/4  | 7/8       |
   * | 5   | 10    | 27/4 | 9/4   | 45/16 | -81/32 | 315/32 | 9/16 | 35/37     |
   * | 6   | 12    | 75/8 | 51/16 | 33/16 | 33/64  | 567/64 | 0    | 1         |
   */
  const prices = [8, 4, 6, 2, 10, 12] as const;

  describe('getResultOrThrow', () => {
    it('reads the share of upward pressure between the Laguerre filter stages', () => {
      const expectations = [7 / 8, 35 / 37, 1] as const;
      const lrsi = new LaguerreRSI();
      const offset = lrsi.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = lrsi.add(price);

        if (result !== null) {
          expect(result).toBe(expectations[i - offset]);
        }
      });

      expect(lrsi.isStable).toBe(true);
    });

    it('pins to exactly 1 while the market rises monotonically', () => {
      const lrsi = new LaguerreRSI();
      const settledReadings: number[] = [];

      for (let bar = 1; bar <= 30; bar++) {
        const result = lrsi.add(bar * 10);

        if (bar >= 5 && result !== null) {
          settledReadings.push(result);
        }
      }

      expect(settledReadings).toStrictEqual(new Array(26).fill(1));
    });

    it('pins to exactly 0 once a monotonic fall has washed out the seed transient', () => {
      const lrsi = new LaguerreRSI();
      const readings: number[] = [];

      for (let bar = 0; bar < 20; bar++) {
        const result = lrsi.add(1_000 - bar * 10);

        if (result !== null) {
          readings.push(result);
        }
      }

      /*
       * The stages charge up from zero, so the first stable reading of a falling market still
       * reports full upward pressure — the documented seed transient.
       */
      expect(readings[0]).toBe(1);
      expect(lrsi.getResultOrThrow()).toBe(0);
    });

    it('degenerates to a delay line of the last four closes when gamma is 0', () => {
      /*
       * Without damping each stage carries one older close, so the pressure sums weigh the last
       * three one-bar changes, e.g. at the 5th close: gains 7 → 11, drops 11 → 6 and 9 → 7,
       * so LRSI = 4 / (4 + 5 + 2) = 4/11.
       */
      const expectations = [4 / 5, 4 / 11, 11 / 16] as const;
      const lrsi = new LaguerreRSI({gamma: 0});
      const offset = lrsi.getRequiredInputs() - 1;

      [5, 9, 7, 11, 6, 13].forEach((price, i) => {
        const result = lrsi.add(price);

        if (result !== null) {
          expect(result).toBe(expectations[i - offset]);
        }
      });
    });

    it('reads 0 when the filter stages have fully leveled out', () => {
      /*
       * A dead market leaves no pressure in either direction (CU + CD = 0). Ehlers' TradeStation
       * code holds the previous reading here and StockSharp emits its neutral level; this
       * implementation reads the absence of upward pressure as 0.
       */
      const lrsi = new LaguerreRSI({gamma: 0});

      for (let i = 0; i < 4; i++) {
        lrsi.add(7);
      }

      expect(lrsi.getResultOrThrow()).toBe(0);
    });
  });

  describe('constructor', () => {
    it('rejects a gamma that is not a real number', () => {
      expect(() => new LaguerreRSI({gamma: Number.NaN})).toThrowError(
        'The gamma has to be at least 0 and below 1, but "NaN" was given.'
      );
    });

    it("defaults to the damping factor of Ehlers' book and accepts a gamma of 0", () => {
      expect(new LaguerreRSI().gamma).toBe(0.5);
      expect(new LaguerreRSI({gamma: 0}).gamma).toBe(0);
    });

    it('rejects a gamma of 1 or above', () => {
      expect(() => new LaguerreRSI({gamma: 1})).toThrow(
        'The gamma has to be at least 0 and below 1, but "1" was given.'
      );
    });

    it('rejects a negative gamma', () => {
      expect(() => new LaguerreRSI({gamma: -0.1})).toThrow(
        'The gamma has to be at least 0 and below 1, but "-0.1" was given.'
      );
    });
  });

  describe('getRequiredInputs', () => {
    it('needs four bars until every filter stage carries price data', () => {
      expect(new LaguerreRSI().getRequiredInputs()).toBe(4);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const lrsi = new LaguerreRSI();

      for (const price of prices.slice(0, -1)) {
        lrsi.add(price);
      }

      /*
       * Replacing the final rally bar (12) with a plunge (2) flips the two youngest stage gaps
       * to downward pressure: L0 = 35/8, L1 = 91/16, L2 = 13/16, L3 = 73/64, so CU = 39/8 and
       * CD = 105/64 → LRSI = 312/417 = 104/139.
       */
      const originalValue = 12;
      const replacedValue = 2;

      const originalResult = lrsi.add(originalValue);

      expect(originalResult).toBe(1);

      const replacedResult = lrsi.replace(replacedValue);

      expect(replacedResult).toBe(104 / 139);

      const restoredResult = lrsi.replace(originalValue);

      expect(restoredResult).toBe(1);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const lrsi = new LaguerreRSI();
      const signal = lrsi.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });

    it('returns BULLISH when the reading reaches into the overbought band', () => {
      const lrsi = new LaguerreRSI();

      for (const price of prices.slice(0, 4)) {
        lrsi.add(price);
      }

      expect(lrsi.getResultOrThrow()).toBe(7 / 8);

      const signal = lrsi.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns BULLISH when the reading sits exactly on the overbought threshold', () => {
      // Delay-line stages 11, 7, 9, 5 weigh gains of 4 + 4 against a drop of 2 → LRSI = 8/10
      const lrsi = new LaguerreRSI({gamma: 0});

      for (const price of [5, 9, 7, 11] as const) {
        lrsi.add(price);
      }

      expect(lrsi.getResultOrThrow()).toBe(0.8);
      expect(lrsi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the reading sits exactly on the oversold threshold', () => {
      // Delay-line stages 9, 13, 11, 15 weigh a gain of 2 against drops of 4 + 4 → LRSI = 2/10
      const lrsi = new LaguerreRSI({gamma: 0});

      for (const price of [15, 11, 13, 9] as const) {
        lrsi.add(price);
      }

      expect(lrsi.getResultOrThrow()).toBe(0.2);
      expect(lrsi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns BEARISH once a sustained fall has drained all upward pressure', () => {
      const lrsi = new LaguerreRSI();

      for (let bar = 0; bar < 20; bar++) {
        lrsi.add(1_000 - bar * 10);
      }

      expect(lrsi.getResultOrThrow()).toBe(0);

      const signal = lrsi.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
      expect(signal.hasChanged).toBe(false);
    });

    it('returns SIDEWAYS while neither band is reached', () => {
      const lrsi = new LaguerreRSI();

      for (const price of [2, 4, 8, 4] as const) {
        lrsi.add(price);
      }

      expect(lrsi.getResultOrThrow()).toBe(5 / 7);
      expect(lrsi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const strict = new LaguerreRSI({signalThresholds: {overbought: 0.9, oversold: 0.1}});
      const loose = new LaguerreRSI({gamma: 0, signalThresholds: {oversold: 0.4}});

      for (const price of prices.slice(0, 4)) {
        strict.add(price);
      }

      expect(strict.getResultOrThrow()).toBe(7 / 8);
      expect(strict.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      for (const price of [5, 9, 7, 11, 6] as const) {
        loose.add(price);
      }

      expect(loose.getResultOrThrow()).toBe(4 / 11);
      expect(loose.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});

testIndicatorContract({
  create: () => new LaguerreRSI(),
  divergentInput: 1_000,
  inputs: [8, 4, 6, 2, 10, 12],
});
