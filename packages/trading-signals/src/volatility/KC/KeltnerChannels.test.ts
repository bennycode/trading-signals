import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {KeltnerChannels} from './KeltnerChannels.js';
import {ATR} from '../ATR/ATR.js';
import {EMA} from '../../trend/EMA/EMA.js';

/*
 * Hand-derived reference series. No Tulip Indicators data exists for Keltner Channels, and
 * external baselines (e.g. Skender.Stock.Indicators) seed the EMA with an SMA of the first
 * closes, while this library seeds the EMA with the first close itself — at the sixth candle
 * below, an SMA-seeded EMA yields 14.625 instead of 14.6875, so those baselines cannot be
 * reproduced here and the series is derived by hand instead.
 *
 * Config: EMA interval 3 (weight 2 / 4 = 0.5, seeded with the first close), ATR interval 2
 * (Wilder smoothing 1 / 2, seeded with the average of the first two true ranges), multiplier 2.
 * TR = max(high - low, |high - previous close|, |low - previous close|); the first TR is
 * high - low. Channel lines: middle ± 2 × ATR.
 *
 * | # | High | Low | Close | EMA(3)  | TR | ATR(2)  | Lower | Middle  | Upper  |
 * |---|------|-----|-------|---------|----|---------|-------|---------|--------|
 * | 1 | 12   |  8  | 10    | 10      | 4  | -       | -     | -       | -      |
 * | 2 | 13   | 10  | 12    | 11      | 3  | 3.5     | -     | -       | -      |
 * | 3 | 15   | 11  | 14    | 12.5    | 4  | 3.75    | 5     | 12.5    | 20     |
 * | 4 | 14   | 10  | 11    | 11.75   | 4  | 3.875   | 4     | 11.75   | 19.5   |
 * | 5 | 16   | 12  | 15    | 13.375  | 5  | 4.4375  | 4.5   | 13.375  | 22.25  |
 * | 6 | 17   | 13  | 16    | 14.6875 | 4  | 4.21875 | 6.25  | 14.6875 | 23.125 |
 *
 * All values are exact binary fractions, so the assertions compare exact numbers.
 * Formula verified with: https://school.stockcharts.com/doku.php?id=technical_indicators:keltner_channels
 */
const referenceConfig = {atrInterval: 2, emaInterval: 3, multiplier: 2} as const;

const referenceCandles = [
  {close: 10, high: 12, low: 8},
  {close: 12, high: 13, low: 10},
  {close: 14, high: 15, low: 11},
  {close: 11, high: 14, low: 10},
  {close: 15, high: 16, low: 12},
  {close: 16, high: 17, low: 13},
] as const;

describe('KeltnerChannels', () => {
  describe('constructor', () => {
    it('defaults to an EMA of 20, an ATR of 10 and a multiplier of 2', () => {
      const withDefaults = new KeltnerChannels();
      const explicit = new KeltnerChannels({atrInterval: 10, emaInterval: 20, multiplier: 2});

      expect(withDefaults.atrInterval).toBe(10);
      expect(withDefaults.emaInterval).toBe(20);
      expect(withDefaults.multiplier).toBe(2);
      expect(withDefaults.getRequiredInputs()).toBe(20);

      for (let i = 0; i < 25; i++) {
        const candle = {close: 100 + i, high: 102 + i, low: 97 + i} as const;
        withDefaults.add(candle);
        explicit.add(candle);
      }

      expect(withDefaults.getResultOrThrow()).toEqual(explicit.getResultOrThrow());
    });
  });

  describe('getRequiredInputs', () => {
    it('is driven by the slower of its two component indicators', () => {
      const emaBound = new KeltnerChannels({atrInterval: 2, emaInterval: 5, multiplier: 2});
      const atrBound = new KeltnerChannels({atrInterval: 7, emaInterval: 3, multiplier: 2});

      expect(emaBound.getRequiredInputs()).toBe(5);
      expect(atrBound.getRequiredInputs()).toBe(7);
    });
  });

  describe('update', () => {
    it('matches the hand-derived reference series', () => {
      const expectations = [
        {lower: 5, middle: 12.5, upper: 20},
        {lower: 4, middle: 11.75, upper: 19.5},
        {lower: 4.5, middle: 13.375, upper: 22.25},
        {lower: 6.25, middle: 14.6875, upper: 23.125},
      ] as const;
      const kc = new KeltnerChannels(referenceConfig);
      const offset = kc.getRequiredInputs() - 1;

      referenceCandles.forEach((candle, i) => {
        const result = kc.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(kc.isStable).toBe(true);
      expect(kc.getRequiredInputs()).toBe(3);
    });

    it('yields no result while the ATR is still warming up even though the EMA is already stable', () => {
      const kc = new KeltnerChannels({atrInterval: 5, emaInterval: 3, multiplier: 2});

      referenceCandles.forEach((candle, i) => {
        const result = kc.add(candle);

        if (i < 4) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
        }
      });
    });

    it('separates the channel lines by twice the multiplier times the ATR', () => {
      const candles = [
        {close: 91, high: 95, low: 88},
        {close: 96, high: 98, low: 90},
        {close: 94, high: 99, low: 92},
        {close: 89, high: 95, low: 87},
        {close: 92, high: 93, low: 86},
        {close: 99, high: 101, low: 91},
        {close: 104, high: 106, low: 98},
        {close: 101, high: 107, low: 99},
        {close: 97, high: 103, low: 94},
        {close: 103, high: 105, low: 96},
        {close: 106, high: 110, low: 102},
        {close: 100, high: 108, low: 99},
      ] as const;
      const multiplier = 3;
      const kc = new KeltnerChannels({atrInterval: 4, emaInterval: 6, multiplier});
      const atr = new ATR(4);
      let stableResults = 0;

      for (const candle of candles) {
        const result = kc.add(candle);
        const atrResult = atr.add(candle);

        if (result && atrResult !== null) {
          stableResults++;
          expect(result.upper - result.lower).toBeCloseTo(2 * multiplier * atrResult, 12);
        }
      }

      expect(stableResults).toBe(candles.length - 5);
    });

    it('pins all three lines to the price when candles never move', () => {
      const kc = new KeltnerChannels(referenceConfig);

      for (let i = 0; i < 10; i++) {
        kc.add({close: 100, high: 100, low: 100});
      }

      expect(kc.getResultOrThrow()).toEqual({lower: 100, middle: 100, upper: 100});
    });

    it('collapses the channel lines onto the middle EMA line when the multiplier is zero', () => {
      const kc = new KeltnerChannels({atrInterval: 2, emaInterval: 3, multiplier: 0});
      const ema = new EMA(3);

      referenceCandles.forEach(candle => {
        const result = kc.add(candle);
        const emaResult = ema.add(candle.close);

        if (result) {
          expect(result.lower).toBe(result.middle);
          expect(result.upper).toBe(result.middle);
          expect(result.middle).toBe(emaResult);
        }
      });

      expect(kc.isStable).toBe(true);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added candle and can restore it', () => {
      const kc = new KeltnerChannels(referenceConfig);

      for (const candle of referenceCandles) {
        kc.add(candle);
      }

      const originalCandle = {close: 17, high: 18, low: 14} as const;
      const replacementCandle = {close: 12, high: 20, low: 10} as const;

      const originalResult = kc.add(originalCandle);

      expect(originalResult).toEqual({lower: 7.625, middle: 15.84375, upper: 24.0625});

      const replacedResult = kc.replace(replacementCandle);

      expect(replacedResult).toEqual({lower: -0.875, middle: 13.34375, upper: 27.5625});

      const restoredResult = kc.replace(originalCandle);

      expect(restoredResult).toEqual({lower: 7.625, middle: 15.84375, upper: 24.0625});
    });
  });
});

testIndicatorContract({
  create: () => new KeltnerChannels(referenceConfig),
  divergentInput: {close: 90, high: 100, low: 80},
  inputs: referenceCandles,
});
