import {TradingSignal} from '../../base/index.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {STC} from './STC.js';

describe('STC', () => {
  /*
   * Reference data note: Skender.Stock.Indicators v3.0.0 ships `stc.standard.json`, but it does
   * not implement Doug Schaff's formula — their STC is a single stochastic pass over the MACD
   * line whose %K is smoothed with a 3-bar SMA, instead of Schaff's cascade of two stochastic
   * scalings that each carry half of every change. Feeding their `default.csv` quotes through
   * this implementation confirms the structural difference: the 435 comparable bars diverge by
   * up to 86.68 (mean 15.64), and long stretches of their series pin at exactly 0 where the
   * cascade reads a neutral 50. No seeding tweak can reconcile the two, so the expectations
   * below are hand-derived from Schaff's formula instead.
   *
   * Worksheet for a cycle interval of 3 with EMAs over 1 and 3 prices: the fast EMA echoes the
   * price itself and the slow EMA carries exactly half of every change, so every stage below
   * stays an exact binary fraction. MACD readings are collected once both EMAs are warm
   * (t >= 3). %K locates the latest MACD in its 3-reading window (equal extremes read 50), %D
   * carries half of every %K change, %KK locates %D in its own 3-reading window and the STC
   * carries half of every %KK change.
   *
   * | t  | price | slow EMA | MACD | %K    | %D        | %KK | STC  |
   * |----|-------|----------|------|-------|-----------|-----|------|
   * | 1  | 10    | 10       |      |       |           |     |      |
   * | 2  | 12    | 11       |      |       |           |     |      |
   * | 3  | 15    | 13       | 2    |       |           |     |      |
   * | 4  | 21    | 17       | 4    |       |           |     |      |
   * | 5  | 23    | 20       | 3    | 50    | 50        |     |      |
   * | 6  | 18    | 19       | -1   | 0     | 25        |     |      |
   * | 7  | 35    | 27       | 8    | 100   | 62.5      | 100 | 100  |
   * | 8  | 43    | 35       | 8    | 100   | 81.25     | 100 | 100  |
   * | 9  | 35    | 35       | 0    | 0     | 40.625    | 0   | 50   |
   * | 10 | 48    | 41.5     | 6.5  | 81.25 | 60.9375   | 50  | 50   |
   * | 11 | 37.5  | 39.5     | -2   | 0     | 30.46875  | 0   | 25   |
   * | 12 | 33.5  | 36.5     | -3   | 0     | 15.234375 | 0   | 12.5 |
   */
  const worksheetConfig = {cycleInterval: 3, fastInterval: 1, slowInterval: 3} as const;
  const worksheetPrices = [10, 12, 15, 21, 23, 18, 35, 43, 35, 48, 37.5, 33.5] as const;

  describe('constructor', () => {
    it('rejects a cycle interval that cannot span a range', () => {
      expect(() => new STC({cycleInterval: 1})).toThrowError(
        'The cycle interval has to be at least 2, but "1" was given.'
      );
    });
  });

  describe('getResultOrThrow', () => {
    it('runs the MACD line through two stochastic scalings with halfway smoothing', () => {
      const expectations = [100, 100, 50, 50, 25, 12.5] as const;
      const stc = new STC(worksheetConfig);
      const offset = stc.getRequiredInputs() - 1;
      let resultCount = 0;

      worksheetPrices.forEach((price, i) => {
        const result = stc.add(price);

        if (result !== null) {
          resultCount += 1;
          expect(result).toBe(expectations[i - offset]);
        }
      });

      expect(resultCount).toBe(expectations.length);
      expect(stc.isStable).toBe(true);
    });

    it('reads a dead-flat market as neutral', () => {
      const stc = new STC(worksheetConfig);

      for (let i = 0; i < 7; i++) {
        stc.add(100);
      }

      expect(stc.getResultOrThrow()).toBe(50);
      expect(stc.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('completes the declared warm-up exactly using its default intervals', () => {
      /*
       * A dead-flat warm-up parks the MACD at zero, so the first cycle reading is neutral; the
       * rally that follows tops every window from then on, which lifts the first STC reading to
       * exactly 100 once both scaling windows are filled.
       */
      const stc = new STC();
      const requiredInputs = stc.getRequiredInputs();
      const priceAt = (bar: number) => (bar < 60 ? 100 : 100 + (bar - 59) * 10);

      for (let bar = 1; bar < requiredInputs; bar++) {
        expect(stc.add(priceAt(bar)), `no result after ${bar} of ${requiredInputs} prices`).toBeNull();
      }

      expect(stc.add(priceAt(requiredInputs))).toBe(100);
    });
  });

  describe('getRequiredInputs', () => {
    it('spans the slower EMA warm-up plus both scaling windows', () => {
      expect(new STC().getRequiredInputs()).toBe(68);
      expect(new STC(worksheetConfig).getRequiredInputs()).toBe(7);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value across both smoothing stages', () => {
      const stc = new STC(worksheetConfig);

      for (const price of worksheetPrices.slice(0, 10)) {
        stc.add(price);
      }

      /*
       * Replacing the 11th price with 100: the slow EMA reads 0.5 × 100 + 0.5 × 41.5 = 70.75, so
       * the MACD jumps to 29.25 — the top of its window (%K = 100). %D resumes from 60.9375 and
       * reaches 80.46875, again the top of its window (%KK = 100), and the STC resumes from 50
       * and reaches 75. Restoring the original price has to rewind both smoothing stages back to
       * the worksheet values.
       */
      const originalValue = 37.5;
      const replacedValue = 100;

      const originalResult = stc.add(originalValue);

      expect(originalResult).toBe(25);

      const replacedResult = stc.replace(replacedValue);

      expect(replacedResult).toBe(75);

      const restoredResult = stc.replace(originalValue);

      expect(restoredResult).toBe(25);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN while the indicator warms up', () => {
      const stc = new STC(worksheetConfig);

      for (const price of worksheetPrices.slice(0, 6)) {
        stc.add(price);
      }

      const signal = stc.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });

    it('returns BULLISH when the cycle is overbought', () => {
      const stc = new STC(worksheetConfig);

      for (const price of worksheetPrices.slice(0, 7)) {
        stc.add(price);
      }

      expect(stc.getResultOrThrow()).toBe(100);

      const signal = stc.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns SIDEWAYS when the cycle rests mid-range', () => {
      const stc = new STC(worksheetConfig);

      for (const price of worksheetPrices.slice(0, 9)) {
        stc.add(price);
      }

      expect(stc.getResultOrThrow()).toBe(50);

      const signal = stc.getSignal();

      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns BEARISH when the cycle is oversold', () => {
      const stc = new STC(worksheetConfig);

      for (const price of worksheetPrices.slice(0, 11)) {
        stc.add(price);
      }

      // A reading exactly on the oversold threshold already counts as oversold
      expect(stc.getResultOrThrow()).toBe(25);

      const signal = stc.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('keeps the signal state while the cycle stays put', () => {
      const stc = new STC(worksheetConfig);

      for (const price of worksheetPrices) {
        stc.add(price);
      }

      expect(stc.getResultOrThrow()).toBe(12.5);

      const signal = stc.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
      expect(signal.hasChanged).toBe(false);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const stc = new STC({...worksheetConfig, signalThresholds: {overbought: 100, oversold: 10}});

      for (const price of worksheetPrices.slice(0, 7)) {
        stc.add(price);
      }

      // A reading exactly on the overbought threshold already counts as overbought
      expect(stc.getResultOrThrow()).toBe(100);
      expect(stc.getSignal().state).toBe(TradingSignal.BULLISH);

      for (const price of worksheetPrices.slice(7, 11)) {
        stc.add(price);
      }

      // The default thresholds would read 25 as oversold, but the widened band keeps it neutral
      expect(stc.getResultOrThrow()).toBe(25);
      expect(stc.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });
});

testIndicatorContract({
  create: () => new STC({cycleInterval: 3, fastInterval: 1, slowInterval: 3}),
  divergentInput: 1_000,
  inputs: [10, 12, 15, 21, 23, 18, 35, 43, 35, 48, 37.5, 33.5],
});
