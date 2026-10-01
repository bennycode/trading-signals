import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {PVI} from './PVI.js';

describe('PVI', () => {
  describe('getResultOrThrow', () => {
    it('keeps the index untouched when the previous close is zero', () => {
      const pvi = new PVI();

      pvi.add({close: 0, high: 0, low: 0, volume: 100});

      expect(pvi.add({close: 10, high: 10, low: 10, volume: 200})).toBe(1_000);
    });

    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      /*
       * Test data verified with:
       * @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L322-L325
       */
      const candles = [
        {close: 81.59, high: 82.15, low: 81.29, volume: 5_653_100},
        {close: 81.06, high: 81.89, low: 80.64, volume: 6_447_400},
        {close: 82.87, high: 83.03, low: 81.31, volume: 7_690_900},
        {close: 83.0, high: 83.3, low: 82.65, volume: 3_831_400},
        {close: 83.61, high: 83.85, low: 83.07, volume: 4_455_100},
        {close: 83.15, high: 83.9, low: 83.11, volume: 3_798_000},
        {close: 82.84, high: 83.33, low: 82.49, volume: 3_936_200},
        {close: 83.99, high: 84.3, low: 82.3, volume: 4_732_000},
        {close: 84.55, high: 84.84, low: 84.15, volume: 4_841_300},
        {close: 84.36, high: 85.0, low: 84.11, volume: 3_915_300},
        {close: 85.53, high: 85.9, low: 84.03, volume: 6_830_800},
        {close: 86.54, high: 86.58, low: 85.39, volume: 6_694_100},
        {close: 86.89, high: 86.98, low: 85.76, volume: 5_293_600},
        {close: 87.77, high: 88.0, low: 87.17, volume: 7_985_800},
        {close: 87.29, high: 87.87, low: 87.01, volume: 4_807_900},
      ] as const;
      const expectations = [
        '1000.000',
        '993.504',
        '1015.688',
        '1015.688',
        '1023.153',
        '1023.153',
        '1019.338',
        '1033.489',
        '1040.380',
        '1040.380',
        '1054.809',
        '1054.809',
        '1054.809',
        '1065.492',
        '1065.492',
      ] as const;
      const pvi = new PVI();
      const offset = pvi.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = pvi.add(candle);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(pvi.isStable).toBe(true);
      expect(pvi.getRequiredInputs()).toBe(1);
    });

    it('starts the index at its conventional base of 1000 on the first bar', () => {
      const pvi = new PVI();

      expect(pvi.add({close: 81.59, high: 82.15, low: 81.29, volume: 5_653_100})).toBe(1_000);
      expect(pvi.isStable).toBe(true);
    });

    it('keeps the index flat when volume is unchanged', () => {
      const pvi = new PVI();

      pvi.add({close: 100, high: 100, low: 100, volume: 1_000});
      pvi.add({close: 150, high: 150, low: 150, volume: 1_000});

      expect(pvi.getResultOrThrow()).toBe(1_000);
    });
  });

  describe('replace', () => {
    /** Keeps the tests focused on close and volume by faking a candle that has no intra-bar movement. */
    const fakeFlatCandle = (close: number, volume: number) => ({close, high: close, low: close, volume}) as const;

    it('replaces a crowd day with a quiet day and back', () => {
      const pvi = new PVI();

      pvi.add(fakeFlatCandle(100, 1_000));

      const risingVolume = fakeFlatCandle(110, 2_000);
      const fallingVolume = fakeFlatCandle(110, 500);

      const originalResult = pvi.add(risingVolume);

      expect(originalResult, 'a 10% close gain on expanding volume compounds the index').toBe(1_100);

      const replacedResult = pvi.replace(fallingVolume);

      expect(replacedResult, 'the same close gain on shrinking volume leaves the index flat').toBe(1_000);

      const restoredResult = pvi.replace(risingVolume);

      expect(restoredResult).toBe(originalResult);
    });

    it('replaces a quiet day with a crowd day and compounds onto the index from before the replaced bar', () => {
      const replaced = new PVI();

      replaced.add(fakeFlatCandle(100, 1_000));
      replaced.add(fakeFlatCandle(110, 2_000));
      replaced.add(fakeFlatCandle(121, 1_500));

      expect(replaced.getResultOrThrow(), 'shrinking volume leaves the index flat').toBe(1_100);

      replaced.replace(fakeFlatCandle(121, 3_000));

      expect(replaced.getResultOrThrow(), 'a replacement must not count the replaced bar twice').toBe(1_210);

      const reference = new PVI();

      reference.add(fakeFlatCandle(100, 1_000));
      reference.add(fakeFlatCandle(110, 2_000));
      reference.add(fakeFlatCandle(121, 3_000));

      expect(replaced.getResultOrThrow()).toBe(reference.getResultOrThrow());
    });
  });
});

testIndicatorContract({
  create: () => new PVI(),
  divergentInput: {close: 500, high: 500, low: 500, volume: 99_000_000},
  inputs: [
    {close: 81.59, high: 82.15, low: 81.29, volume: 5_653_100},
    {close: 81.06, high: 81.89, low: 80.64, volume: 6_447_400},
    {close: 82.87, high: 83.03, low: 81.31, volume: 7_690_900},
    {close: 83.0, high: 83.3, low: 82.65, volume: 3_831_400},
    {close: 83.61, high: 83.85, low: 83.07, volume: 4_455_100},
  ],
});
