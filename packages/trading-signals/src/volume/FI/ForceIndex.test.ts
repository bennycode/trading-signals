import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {ForceIndex} from './ForceIndex.js';
import {TradingSignal} from '../../base/index.js';

describe('ForceIndex', () => {
  /*
   * There is no Tulip Indicators baseline for the Force Index, and third-party baselines
   * (e.g. Skender.Stock.Indicators) seed the smoothing EMA with an SMA of the first raw force
   * values. An SMA-seeded EMA never coincides with an EMA seeded from the first value — the
   * seeding difference only decays geometrically — so those baselines are not reproducible
   * here. The expectations below are derived by hand instead, with an interval of 3, giving a
   * smoothing weight of 2 / (3 + 1) = 0.5:
   *
   * Candle 2: force = (11 - 10) * 200 = 200 -> smoothed = 200 (seed)
   * Candle 3: force = (12 - 11) * 150 = 150 -> smoothed = 150 * 0.5 + 200 * 0.5 = 175
   * Candle 4: force = (11.5 - 12) * 300 = -150 -> smoothed = -150 * 0.5 + 175 * 0.5 = 12.5
   * Candle 5: force = (12.5 - 11.5) * 250 = 250 -> smoothed = 250 * 0.5 + 12.5 * 0.5 = 131.25
   * Candle 6: force = (12 - 12.5) * 200 = -100 -> smoothed = -100 * 0.5 + 131.25 * 0.5 = 15.625
   *
   * The smoothing is only considered stable from candle 4 onwards, so 12.5 is the first result.
   *
   * @see https://school.stockcharts.com/doku.php?id=technical_indicators:force_index
   * @see Alexander Elder, "Trading for a Living" (1993)
   */
  const candles = [
    {close: 10, high: 10.5, low: 9.5, volume: 100},
    {close: 11, high: 11.5, low: 10, volume: 200},
    {close: 12, high: 12.5, low: 11, volume: 150},
    {close: 11.5, high: 12, low: 11, volume: 300},
    {close: 12.5, high: 13, low: 11.5, volume: 250},
    {close: 12, high: 12.5, low: 11.5, volume: 200},
  ] as const;
  const expectations = [12.5, 131.25, 15.625] as const;

  describe('constructor', () => {
    it('smooths over 13 candles by default and needs one extra candle for the first force reading', () => {
      const fi = new ForceIndex();

      expect(fi.interval).toBe(13);
      expect(fi.getRequiredInputs()).toBe(14);
    });
  });

  describe('getResultOrThrow', () => {
    it('smooths the raw force of each candle with an EMA', () => {
      const fi = new ForceIndex(3);
      const offset = fi.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = fi.add(candle);

        if (result !== null) {
          expect(result).toBe(expectations[i - offset]);
        }
      });

      expect(fi.isStable).toBe(true);
      expect(fi.getRequiredInputs()).toBe(4);
    });

    it('stays at zero when closing prices never change', () => {
      const fi = new ForceIndex(3);

      for (let i = 0; i < 4; i++) {
        fi.add({close: 100, high: 101, low: 99, volume: 500});
      }

      expect(fi.getResultOrThrow()).toBe(0);
    });

    it('turns positive when prices rise on volume', () => {
      const fi = new ForceIndex(3);

      for (let i = 0; i < 4; i++) {
        fi.add({close: 10 + i, high: 11 + i, low: 9 + i, volume: 100});
      }

      expect(fi.getResultOrThrow()).toBe(100);
    });

    it('turns negative when prices fall on volume', () => {
      const fi = new ForceIndex(3);

      for (let i = 0; i < 4; i++) {
        fi.add({close: 13 - i, high: 14 - i, low: 12 - i, volume: 100});
      }

      expect(fi.getResultOrThrow()).toBe(-100);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const fi = new ForceIndex(3);

      for (const candle of candles) {
        fi.add(candle);
      }

      expect(fi.getResultOrThrow()).toBe(15.625);

      const originalValue = {close: 13, high: 13.5, low: 12, volume: 400} as const;
      const replacedValue = {close: 11, high: 12, low: 10.5, volume: 400} as const;

      const originalResult = fi.add(originalValue);

      expect(originalResult).toBe(207.8125);

      const replacedResult = fi.replace(replacedValue);

      expect(replacedResult).toBe(-192.1875);

      const restoredResult = fi.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const fi = new ForceIndex(13);

      expect(fi.getSignal()).toStrictEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH when buyers are in control', () => {
      const fi = new ForceIndex(3);

      for (let i = 0; i < 4; i++) {
        fi.add({close: 10 + i, high: 11 + i, low: 9 + i, volume: 100});
      }

      expect(fi.getResultOrThrow()).toBeGreaterThan(0);
      expect(fi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when sellers are in control', () => {
      const fi = new ForceIndex(3);

      for (let i = 0; i < 4; i++) {
        fi.add({close: 13 - i, high: 14 - i, low: 12 - i, volume: 100});
      }

      expect(fi.getResultOrThrow()).toBeLessThan(0);
      expect(fi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when neither side exerts force', () => {
      const fi = new ForceIndex(3);

      for (let i = 0; i < 4; i++) {
        fi.add({close: 100, high: 101, low: 99, volume: 500});
      }

      expect(fi.getResultOrThrow()).toBe(0);
      expect(fi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags the change when control flips from buyers to sellers', () => {
      const fi = new ForceIndex(2);

      fi.add({close: 10, high: 10.5, low: 9.5, volume: 100});
      fi.add({close: 11, high: 11.5, low: 10, volume: 100});
      fi.add({close: 12, high: 12.5, low: 11, volume: 100});

      expect(fi.getSignal()).toStrictEqual({hasChanged: true, state: TradingSignal.BULLISH});

      fi.add({close: 5, high: 12, low: 5, volume: 1_000});

      expect(fi.getSignal()).toStrictEqual({hasChanged: true, state: TradingSignal.BEARISH});

      fi.add({close: 4, high: 5, low: 4, volume: 1_000});

      expect(fi.getSignal()).toStrictEqual({hasChanged: false, state: TradingSignal.BEARISH});
    });
  });
});

testIndicatorContract({
  create: () => new ForceIndex(5),
  divergentInput: {close: 249, high: 250, low: 150, volume: 99_000_000},
  inputs: [
    {close: 81.59, high: 82.15, low: 81.29, volume: 5_653_100},
    {close: 81.06, high: 81.89, low: 80.64, volume: 6_447_400},
    {close: 82.87, high: 83.03, low: 81.31, volume: 7_690_900},
    {close: 83.0, high: 83.3, low: 82.65, volume: 3_831_400},
    {close: 83.61, high: 83.85, low: 83.07, volume: 4_455_100},
    {close: 83.15, high: 83.9, low: 83.11, volume: 3_798_000},
    {close: 82.84, high: 83.33, low: 82.49, volume: 3_936_200},
  ],
});
