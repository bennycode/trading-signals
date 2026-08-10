import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {ElderRay} from './ElderRay.js';
import {TradingSignal} from '../../base/index.js';

describe('ElderRay', () => {
  describe('update', () => {
    it('calculates bull and bear power as the distance of high and low to the consensus of value', () => {
      /*
       * Formula (Dr. Alexander Elder, "Trading for a Living", 1993):
       * Bull Power = High - EMA(13, Close)
       * Bear Power = Low - EMA(13, Close)
       * https://school.stockcharts.com/doku.php?id=technical_indicators:elder_ray_index
       *
       * Tulip Indicators ships no Elder Ray reference data, and Skender's baseline seeds its EMA
       * with an SMA, so its early values diverge from this library's first-price-seeded EMA.
       * The expectations below are therefore derived by hand with interval 3
       * (weight factor 2 / (3 + 1) = 0.5):
       *
       * | Bar | High | Low | Close | EMA                         | Bull Power | Bear Power |
       * |-----|------|-----|-------|-----------------------------|------------|------------|
       * | 1   | 12   | 8   | 10    | 10 (seed)                   | -          | -          |
       * | 2   | 14   | 10  | 12    | 12*0.5 + 10*0.5    = 11     | -          | -          |
       * | 3   | 16   | 12  | 14    | 14*0.5 + 11*0.5    = 12.5   | 3.5        | -0.5       |
       * | 4   | 18   | 14  | 16    | 16*0.5 + 12.5*0.5  = 14.25  | 3.75       | -0.25      |
       * | 5   | 15   | 11  | 12    | 12*0.5 + 14.25*0.5 = 13.125 | 1.875      | -2.125     |
       */
      const candles = [
        {close: 10, high: 12, low: 8},
        {close: 12, high: 14, low: 10},
        {close: 14, high: 16, low: 12},
        {close: 16, high: 18, low: 14},
        {close: 12, high: 15, low: 11},
      ] as const;
      const expectations = [
        {bearPower: -0.5, bullPower: 3.5},
        {bearPower: -0.25, bullPower: 3.75},
        {bearPower: -2.125, bullPower: 1.875},
      ] as const;
      const eri = new ElderRay(3);
      const offset = eri.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = eri.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(eri.isStable).toBe(true);
    });

    it('spans exactly the candle range with both powers combined', () => {
      /*
       * The consensus of value cancels out of the spread between the two powers, so bull power
       * minus bear power always equals the candle's own high-to-low range, bit for bit.
       */
      const candles = [
        {close: 99.34, high: 101.25, low: 98.6},
        {close: 106.42, high: 108.4, low: 105.05},
        {close: 110.47, high: 112.52, low: 108.47},
        {close: 109.89, high: 110.81, low: 107.26},
        {close: 105.25, high: 106.24, low: 103.19},
        {close: 97.38, high: 100.09, low: 96.34},
        {close: 92.81, high: 94.39, low: 91.14},
        {close: 92.35, high: 94, low: 90.05},
        {close: 96.5, high: 98.22, low: 94.77},
        {close: 103.62, high: 104.21, low: 101.26},
        {close: 109.01, high: 111.32, low: 107.67},
        {close: 112.96, high: 115.34, low: 110.99},
        {close: 112.27, high: 113.52, low: 110.87},
        {close: 107.55, high: 108.87, low: 105.52},
        {close: 101.34, high: 102.73, low: 98.68},
        {close: 95.19, high: 97.1, low: 93.55},
        {close: 94.84, high: 96.82, low: 93.77},
        {close: 99.09, high: 101.14, low: 97.39},
        {close: 106.25, high: 107.17, low: 103.92},
        {close: 113.25, high: 114.24, low: 110.29},
        {close: 115.45, high: 118.16, low: 114.71},
        {close: 114.64, high: 116.22, low: 113.27},
        {close: 109.85, high: 111.5, low: 107.85},
        {close: 103.64, high: 105.36, low: 101.01},
        {close: 99.22, high: 99.81, low: 97.16},
      ] as const;
      const eri = new ElderRay(13);
      let verifiedBars = 0;

      candles.forEach(candle => {
        const result = eri.add(candle);

        if (result) {
          verifiedBars++;
          expect(result.bullPower - result.bearPower).toBe(candle.high - candle.low);
        }
      });

      expect(verifiedBars).toBe(13);
    });

    it('ends a strongly rising series with buyers in control of the whole bar', () => {
      const risingCandles = Array.from({length: 20}, (_, i) => ({
        close: 100 + i * 5,
        high: 102 + i * 5,
        low: 98 + i * 5,
      }));
      const eri = new ElderRay(13);

      risingCandles.forEach(candle => eri.add(candle));

      const result = eri.getResultOrThrow();

      expect(result.bullPower).toBeGreaterThan(0);
      expect(result.bearPower).toBeGreaterThan(0);
      expect(eri.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('ends a strongly falling series with sellers in control of the whole bar', () => {
      const fallingCandles = Array.from({length: 20}, (_, i) => ({
        close: 200 - i * 5,
        high: 202 - i * 5,
        low: 198 - i * 5,
      }));
      const eri = new ElderRay(13);

      fallingCandles.forEach(candle => eri.add(candle));

      const result = eri.getResultOrThrow();

      expect(result.bullPower).toBeLessThan(0);
      expect(result.bearPower).toBeLessThan(0);
      expect(eri.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });

  describe('getRequiredInputs', () => {
    it('uses an interval of 13 periods by default, as recommended by Elder', () => {
      expect(new ElderRay().getRequiredInputs()).toBe(13);
      expect(new ElderRay(3).getRequiredInputs()).toBe(3);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const eri = new ElderRay(3);

      eri.add({close: 10, high: 12, low: 8});
      eri.add({close: 12, high: 14, low: 10});
      eri.add({close: 14, high: 16, low: 12});

      const originalCandle = {close: 16, high: 18, low: 14} as const;
      const replacementCandle = {close: 28, high: 30, low: 26} as const;

      const originalResult = eri.add(originalCandle);

      expect(originalResult).toEqual({bearPower: -0.25, bullPower: 3.75});

      const replacedResult = eri.replace(replacementCandle);

      expect(replacedResult).toEqual({bearPower: 5.75, bullPower: 9.75});

      const restoredResult = eri.replace(originalCandle);

      expect(restoredResult).toEqual({bearPower: -0.25, bullPower: 3.75});
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const eri = new ElderRay(3);

      expect(eri.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});

      eri.add({close: 10, high: 11, low: 9});
      eri.add({close: 10, high: 11, low: 9});

      expect(eri.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH when even the low trades above the consensus of value', () => {
      const eri = new ElderRay(3);

      eri.add({close: 10, high: 11, low: 9});
      eri.add({close: 10, high: 11, low: 9});
      eri.add({close: 10, high: 11, low: 9});
      eri.add({close: 38, high: 40, low: 30});

      expect(eri.getResultOrThrow()).toEqual({bearPower: 6, bullPower: 16});
      expect(eri.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when even the high stays below the consensus of value', () => {
      const eri = new ElderRay(3);

      eri.add({close: 40, high: 41, low: 39});
      eri.add({close: 40, high: 41, low: 39});
      eri.add({close: 40, high: 41, low: 39});
      eri.add({close: 4, high: 12, low: 2});

      expect(eri.getResultOrThrow()).toEqual({bearPower: -20, bullPower: -10});
      expect(eri.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the candle straddles the consensus of value', () => {
      const eri = new ElderRay(3);

      eri.add({close: 10, high: 11, low: 9});
      eri.add({close: 10, high: 11, low: 9});
      eri.add({close: 10, high: 11, low: 9});

      expect(eri.getResultOrThrow()).toEqual({bearPower: -1, bullPower: 1});
      expect(eri.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('returns SIDEWAYS when neither side pushes the price away from the consensus of value', () => {
      const eri = new ElderRay(3);

      eri.add({close: 10, high: 10, low: 10});
      eri.add({close: 10, high: 10, low: 10});
      eri.add({close: 10, high: 10, low: 10});

      expect(eri.getResultOrThrow()).toEqual({bearPower: 0, bullPower: 0});
      expect(eri.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags a change only when the signal switches its state', () => {
      const eri = new ElderRay(3);

      eri.add({close: 10, high: 11, low: 9});
      eri.add({close: 10, high: 11, low: 9});
      eri.add({close: 10, high: 11, low: 9});

      expect(eri.getSignal()).toEqual({hasChanged: true, state: TradingSignal.SIDEWAYS});

      eri.add({close: 38, high: 40, low: 30});

      expect(eri.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});

      eri.add({close: 42, high: 44, low: 36});

      expect(eri.getSignal()).toEqual({hasChanged: false, state: TradingSignal.BULLISH});
    });
  });
});

testIndicatorContract({
  create: () => new ElderRay(3),
  divergentInput: {close: 1_000, high: 1_010, low: 990},
  inputs: [
    {close: 10, high: 12, low: 8},
    {close: 12, high: 14, low: 10},
    {close: 14, high: 16, low: 12},
    {close: 16, high: 18, low: 14},
    {close: 12, high: 15, low: 11},
  ],
});
