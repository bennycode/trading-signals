import {TradingSignal} from '../../base/index.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {DeMarker} from './DeMarker.js';

describe('DeMarker', () => {
  /*
   * There is no Tulip Indicators entry for the DeMarker, so the expectations are derived by hand from
   * Thomas DeMark's formula as published by MetaQuotes and Investopedia: DeMax = max(high − prevHigh, 0),
   * DeMin = max(prevLow − low, 0), DeM = SMA(DeMax, N) / (SMA(DeMax, N) + SMA(DeMin, N)). Both averages
   * share the same period, so the reading equals the ratio of the sums. Integer candles keep every sum
   * exact, which allows exact assertions (interval 3):
   *
   * | Candle | High | Low | DeMax | DeMin | Σ DeMax | Σ DeMin | DeM        |
   * | ------ | ---- | --- | ----- | ----- | ------- | ------- | ---------- |
   * | 1      | 10   | 5   | —     | —     |         |         |            |
   * | 2      | 12   | 6   | 2     | 0     |         |         |            |
   * | 3      | 11   | 4   | 0     | 2     |         |         |            |
   * | 4      | 15   | 7   | 4     | 0     | 6       | 2       | 6/8 = 0.75 |
   * | 5      | 13   | 3   | 0     | 4     | 4       | 6       | 4/10 = 0.4 |
   * | 6      | 13   | 6   | 0     | 0     | 4       | 4       | 4/8 = 0.5  |
   *
   * @see https://www.metatrader5.com/en/terminal/help/indicators/oscillators/demarker
   * @see https://www.investopedia.com/terms/d/demarkerindicator.asp
   */
  const risingCandles = [
    {high: 10, low: 5},
    {high: 12, low: 6},
    {high: 11, low: 4},
    {high: 15, low: 7},
  ] as const;
  const fallingCandle = {high: 13, low: 3} as const;
  const insideCandle = {high: 13, low: 6} as const;
  const candles = [...risingCandles, fallingCandle, insideCandle] as const;

  describe('getResultOrThrow', () => {
    it('weighs higher-high pressure against lower-low pressure', () => {
      const expectations = [0.75, 0.4, 0.5] as const;
      const dem = new DeMarker({interval: 3});
      const offset = dem.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = dem.add(candle);

        if (result !== null) {
          expect(result).toBe(expectations[i - offset]);
        }
      });

      expect(dem.isStable).toBe(true);
    });

    it('reads 1 when every candle prints a higher high and no lower low', () => {
      const dem = new DeMarker({interval: 3});

      for (const high of [10, 12, 14, 16] as const) {
        dem.add({high, low: high - 2});
      }

      expect(dem.getResultOrThrow()).toBe(1);
    });

    it('reads 0 when every candle prints a lower low and no higher high', () => {
      const dem = new DeMarker({interval: 3});

      for (const low of [16, 14, 12, 10] as const) {
        dem.add({high: low + 2, low});
      }

      expect(dem.getResultOrThrow()).toBe(0);
    });

    it('reads neutral in a dead market without higher highs or lower lows', () => {
      const dem = new DeMarker({interval: 3});
      const flatCandle = {high: 10, low: 5} as const;

      for (let i = 0; i < 5; i++) {
        dem.add(flatCandle);
      }

      expect(dem.getResultOrThrow()).toBe(0.5);

      const signal = dem.getSignal();

      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
      expect(signal.hasChanged).toBe(false);
    });
  });

  describe('getRequiredInputs', () => {
    it('measures 14 comparisons by default, seeded by one extra candle', () => {
      const dem = new DeMarker();

      expect(dem.getRequiredInputs()).toBe(15);
    });

    it('needs one candle more than the configured interval', () => {
      const dem = new DeMarker({interval: 3});

      expect(dem.getRequiredInputs()).toBe(4);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const dem = new DeMarker({interval: 3});

      for (const candle of risingCandles) {
        dem.add(candle);
      }

      /*
       * The replacement candle turns the last comparison around: DeMax = 19 − 15 = 4 and DeMin = 0,
       * so the window sums become 8 and 2 → DeM = 8/10 = 0.8.
       */
      const originalValue = fallingCandle;
      const replacedValue = {high: 19, low: 7} as const;

      const originalResult = dem.add(originalValue);

      expect(originalResult).toBe(0.4);

      const replacedResult = dem.replace(replacedValue);

      expect(replacedResult).toBe(0.8);

      const restoredResult = dem.replace(originalValue);

      expect(restoredResult).toBe(0.4);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const dem = new DeMarker({interval: 3});
      const signal = dem.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });

    it('returns BULLISH when buying pressure dominates the window', () => {
      const dem = new DeMarker({interval: 3});

      for (const candle of risingCandles) {
        dem.add(candle);
      }

      expect(dem.getResultOrThrow()).toBe(0.75);

      const signal = dem.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns BULLISH when the reading sits exactly on the overbought threshold', () => {
      // Σ DeMax = 3 + 4 + 0 = 7 and Σ DeMin = 0 + 1 + 2 = 3 → DeM = 7/10 = 0.7
      const thresholdCandles = [
        {high: 10, low: 9},
        {high: 13, low: 10},
        {high: 17, low: 9},
        {high: 17, low: 7},
      ] as const;
      const dem = new DeMarker({interval: 3});

      for (const candle of thresholdCandles) {
        dem.add(candle);
      }

      expect(dem.getResultOrThrow()).toBe(0.7);
      expect(dem.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when selling pressure dominates the window', () => {
      // Σ DeMax = 1 + 0 + 0 = 1 and Σ DeMin = 2 + 2 + 0 = 4 → DeM = 1/5 = 0.2
      const slidingCandles = [
        {high: 20, low: 15},
        {high: 21, low: 13},
        {high: 21, low: 11},
        {high: 20, low: 11},
      ] as const;
      const dem = new DeMarker({interval: 3});

      for (const candle of slidingCandles) {
        dem.add(candle);
      }

      expect(dem.getResultOrThrow()).toBe(0.2);

      const signal = dem.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns BEARISH when the reading sits exactly on the oversold threshold', () => {
      // Σ DeMax = 3 + 0 + 0 = 3 and Σ DeMin = 3 + 2 + 2 = 7 → DeM = 3/10 = 0.3
      const thresholdCandles = [
        {high: 20, low: 15},
        {high: 23, low: 12},
        {high: 23, low: 10},
        {high: 22, low: 8},
      ] as const;
      const dem = new DeMarker({interval: 3});

      for (const candle of thresholdCandles) {
        dem.add(candle);
      }

      expect(dem.getResultOrThrow()).toBe(0.3);
      expect(dem.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS while neither side dominates', () => {
      const dem = new DeMarker({interval: 3});

      for (const candle of [...risingCandles, fallingCandle]) {
        dem.add(candle);
      }

      expect(dem.getResultOrThrow()).toBe(0.4);
      expect(dem.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const strict = new DeMarker({interval: 3, signalThresholds: {overbought: 0.8, oversold: 0.1}});
      const loose = new DeMarker({interval: 3, signalThresholds: {oversold: 0.45}});

      for (const candle of risingCandles) {
        strict.add(candle);
      }

      expect(strict.getResultOrThrow()).toBe(0.75);
      expect(strict.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      for (const candle of [...risingCandles, fallingCandle]) {
        loose.add(candle);
      }

      expect(loose.getResultOrThrow()).toBe(0.4);
      expect(loose.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});

testIndicatorContract({
  create: () => new DeMarker({interval: 3}),
  divergentInput: {high: 1_000, low: 999},
  inputs: [
    {high: 10, low: 5},
    {high: 12, low: 6},
    {high: 11, low: 4},
    {high: 15, low: 7},
    {high: 13, low: 3},
    {high: 13, low: 6},
  ],
});
