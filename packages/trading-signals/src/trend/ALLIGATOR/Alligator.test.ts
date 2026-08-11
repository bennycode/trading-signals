import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {WSMA} from '../WSMA/WSMA.js';
import {Alligator} from './Alligator.js';
import {GatorOscillator} from './GatorOscillator.js';

/**
 * Hand-derived worksheet with the tiny windows and shifts 3/2 (jaw), 2/1 (teeth) and 1/1 (lips), chosen so every
 * line smooths and displaces differently while all reported values stay exact in floating point. Each candle spans
 * one unit around its median, every SMMA continues as `previous + (median - previous) / interval`, and each line
 * reports the smoothed value produced "shift" bars earlier:
 *
 * | Bar | Median | SMMA(3) | SMMA(2)  | SMMA(1) | Jaw (2 back) | Teeth (1 back) | Lips (1 back) |
 * |-----|--------|---------|----------|---------|--------------|----------------|---------------|
 * | 1   | 6      | -       | -        | 6       | -            | -              | -             |
 * | 2   | 3      | -       | 4.5      | 3       | -            | -              | 6             |
 * | 3   | 9      | 6       | 6.75     | 9       | -            | 4.5            | 3             |
 * | 4   | 12     | 8       | 9.375    | 12      | -            | 6.75           | 9             |
 * | 5   | 20     | 12      | 14.6875  | 20      | 6            | 9.375          | 12            |
 * | 6   | 18     | 14      | 16.34375 | 18      | 8            | 14.6875        | 20            |
 * | 7   | 8      | 12      | 12.171875| 8       | 12           | 16.34375       | 18            |
 *
 * A result only exists once the slowest displaced line does (bar 5), so bars 1-4 yield nothing even though the
 * faster lines already carry values.
 */
const worksheetCandles = [
  {high: 7, low: 5},
  {high: 4, low: 2},
  {high: 10, low: 8},
  {high: 13, low: 11},
  {high: 21, low: 19},
  {high: 19, low: 17},
  {high: 9, low: 7},
] as const;

const worksheetConfig = {
  jawInterval: 3,
  jawShift: 2,
  lipsInterval: 1,
  lipsShift: 1,
  teethInterval: 2,
  teethShift: 1,
} as const;

/*
 * Same smoothing as the worksheet, but with the lips left undisplaced so a replacement of the newest candle
 * becomes visible immediately: the displaced jaw and teeth must ignore the newest bar while the live lips react.
 */
const liveLipsConfig = {
  jawInterval: 3,
  jawShift: 2,
  lipsInterval: 1,
  lipsShift: 0,
  teethInterval: 2,
  teethShift: 1,
} as const;

describe('Alligator', () => {
  describe('constructor', () => {
    it('rejects smoothing windows and displacements that cannot form real buffers', () => {
      expect(() => new Alligator({jawInterval: Number.NaN})).toThrowError(
        'The jawInterval has to be a positive number, but "NaN" was given.'
      );
      expect(() => new Alligator({lipsInterval: 0})).toThrowError(
        'The lipsInterval has to be a positive number, but "0" was given.'
      );
      expect(() => new Alligator({teethShift: -1})).toThrowError(
        'The teethShift has to be zero or a positive number, but "-1" was given.'
      );
      expect(() => new Alligator({jawShift: Number.NaN})).toThrowError(
        'The jawShift has to be zero or a positive number, but "NaN" was given.'
      );
    });

    it('uses the smoothing windows and shifts published by Bill Williams by default', () => {
      const alligator = new Alligator();

      expect(alligator.jawInterval).toBe(13);
      expect(alligator.jawShift).toBe(8);
      expect(alligator.teethInterval).toBe(8);
      expect(alligator.teethShift).toBe(5);
      expect(alligator.lipsInterval).toBe(5);
      expect(alligator.lipsShift).toBe(3);
    });
  });

  describe('getRequiredInputs', () => {
    it('reports the bar count at which the slowest displaced line exists', () => {
      expect(new Alligator().getRequiredInputs()).toBe(21);
      expect(new Alligator(worksheetConfig).getRequiredInputs()).toBe(5);
    });
  });

  describe('add', () => {
    it('reports for the current bar what each line produced its shift ago', () => {
      const expectations = [
        {jaw: 6, lips: 12, teeth: 9.375},
        {jaw: 8, lips: 20, teeth: 14.6875},
        {jaw: 12, lips: 18, teeth: 16.34375},
      ] as const;
      const alligator = new Alligator(worksheetConfig);
      const offset = alligator.getRequiredInputs() - 1;

      worksheetCandles.forEach((candle, i) => {
        const result = alligator.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(alligator.isStable).toBe(true);
    });

    it('adds nothing but the displacement on top of the smoothing: with zero shifts every line equals a live WSMA fed the same medians', () => {
      const candles = [
        {high: 82.59, low: 80.59},
        {high: 82.06, low: 80.06},
        {high: 83.87, low: 81.87},
        {high: 84.0, low: 82.0},
        {high: 84.61, low: 82.61},
        {high: 84.15, low: 82.15},
        {high: 83.84, low: 81.84},
        {high: 84.99, low: 82.99},
        {high: 85.55, low: 83.55},
        {high: 85.36, low: 83.36},
        {high: 86.53, low: 84.53},
        {high: 87.54, low: 85.54},
        {high: 87.89, low: 85.89},
        {high: 88.77, low: 86.77},
        {high: 88.29, low: 86.29},
      ] as const;
      const alligator = new Alligator({jawShift: 0, lipsShift: 0, teethShift: 0});
      const jaw = new WSMA(alligator.jawInterval);
      const lips = new WSMA(alligator.lipsInterval);
      const teeth = new WSMA(alligator.teethInterval);
      let comparisons = 0;

      for (const candle of candles) {
        const median = (candle.high + candle.low) / 2;
        const result = alligator.add(candle);
        const liveJaw = jaw.add(median);
        const liveLips = lips.add(median);
        const liveTeeth = teeth.add(median);

        if (result) {
          comparisons += 1;
          expect(result.jaw).toBe(liveJaw);
          expect(result.lips).toBe(liveLips);
          expect(result.teeth).toBe(liveTeeth);
        }
      }

      expect(comparisons).toBe(3);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const alligator = new Alligator(liveLipsConfig);

      alligator.add({high: 7, low: 5});
      alligator.add({high: 4, low: 2});
      alligator.add({high: 10, low: 8});
      alligator.add({high: 13, low: 11});
      alligator.add({high: 21, low: 19});
      alligator.add({high: 19, low: 17});

      const originalCandle = {high: 9, low: 7} as const;
      const replacementCandle = {high: 31, low: 29} as const;

      const originalResult = alligator.add(originalCandle);

      expect(originalResult).toEqual({jaw: 12, lips: 8, teeth: 16.34375});

      const replacedResult = alligator.replace(replacementCandle);

      expect(replacedResult).toEqual({jaw: 12, lips: 30, teeth: 16.34375});

      const restoredResult = alligator.replace(originalCandle);

      expect(restoredResult).toEqual(originalResult);
    });

    it('surfaces a replaced candle in every line once its displacement has passed', () => {
      /*
       * Replacing the median 20 of bar 5 with 2 leaves the reported bar 5 untouched, because every displaced
       * line still shows what earlier bars produced. From bar 6 on, the smoothing continues from the replaced
       * candle (SMMA(3): 6, 10 / SMMA(2): 5.6875, 11.84375 / SMMA(1): 2, 18), so the add-only worksheet values
       * for bars 6-7 must not reappear.
       */
      const alligator = new Alligator(worksheetConfig);

      alligator.add({high: 7, low: 5});
      alligator.add({high: 4, low: 2});
      alligator.add({high: 10, low: 8});
      alligator.add({high: 13, low: 11});

      const originalResult = alligator.add({high: 21, low: 19});

      expect(originalResult).toEqual({jaw: 6, lips: 12, teeth: 9.375});

      const replacedResult = alligator.replace({high: 3, low: 1});

      expect(replacedResult).toEqual(originalResult);

      expect(alligator.add({high: 19, low: 17})).toEqual({jaw: 8, lips: 2, teeth: 5.6875});
      expect(alligator.add({high: 9, low: 7})).toEqual({jaw: 6, lips: 18, teeth: 11.84375});
    });

    it('supports replacing a candle while still warming up', () => {
      const alligator = new Alligator(worksheetConfig);

      alligator.add({high: 7, low: 5});
      alligator.add({high: 101, low: 99});

      expect(alligator.replace({high: 4, low: 2})).toBeNull();

      alligator.add({high: 10, low: 8});
      alligator.add({high: 13, low: 11});

      expect(alligator.add({high: 21, low: 19})).toEqual({jaw: 6, lips: 12, teeth: 9.375});
    });
  });
});

describe('GatorOscillator', () => {
  describe('getRequiredInputs', () => {
    it('matches the composed Alligator', () => {
      expect(new GatorOscillator().getRequiredInputs()).toBe(21);
      expect(new GatorOscillator(worksheetConfig).getRequiredInputs()).toBe(5);
    });
  });

  describe('add', () => {
    it('mirrors the spread of the displaced lines as histograms around zero', () => {
      const expectations = [
        {lower: -2.625, upper: 3.375},
        {lower: -5.3125, upper: 6.6875},
        {lower: -1.65625, upper: 4.34375},
      ] as const;
      const gator = new GatorOscillator(worksheetConfig);
      const offset = gator.getRequiredInputs() - 1;

      worksheetCandles.forEach((candle, i) => {
        const result = gator.add(candle);

        if (result) {
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(gator.isStable).toBe(true);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const gator = new GatorOscillator(liveLipsConfig);

      gator.add({high: 7, low: 5});
      gator.add({high: 4, low: 2});
      gator.add({high: 10, low: 8});
      gator.add({high: 13, low: 11});
      gator.add({high: 21, low: 19});
      gator.add({high: 19, low: 17});

      const originalCandle = {high: 9, low: 7} as const;
      const replacementCandle = {high: 31, low: 29} as const;

      const originalResult = gator.add(originalCandle);

      expect(originalResult).toEqual({lower: -8.34375, upper: 4.34375});

      const replacedResult = gator.replace(replacementCandle);

      expect(replacedResult).toEqual({lower: -13.65625, upper: 4.34375});

      const restoredResult = gator.replace(originalCandle);

      expect(restoredResult).toEqual(originalResult);
    });
  });
});

testIndicatorContract({
  create: () => new Alligator(worksheetConfig),
  divergentInput: {high: 31, low: 29},
  inputs: worksheetCandles,
});

/*
 * The oscillator's visible snapshot is nothing but its histogram, and displaced lines keep the newest bar out of
 * that histogram. The contract's divergence check can therefore only see a replacement when the displacement is
 * disabled; the displaced replacement behavior is covered by the tests above and by the Alligator's contract.
 */
testIndicatorContract({
  create: () =>
    new GatorOscillator({jawInterval: 3, jawShift: 0, lipsInterval: 1, lipsShift: 0, teethInterval: 2, teethShift: 0}),
  divergentInput: {high: 31, low: 29},
  inputs: worksheetCandles,
});
