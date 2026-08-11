import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {WAD} from './WAD.js';

describe('WAD', () => {
  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      /*
       * Test data verified with:
       * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L471-L475
       */
      const candles = [
        {close: 81.59, high: 82.15, low: 81.29},
        {close: 81.06, high: 81.89, low: 80.64},
        {close: 82.87, high: 83.03, low: 81.31},
        {close: 83.0, high: 83.3, low: 82.65},
        {close: 83.61, high: 83.85, low: 83.07},
        {close: 83.15, high: 83.9, low: 83.11},
        {close: 82.84, high: 83.33, low: 82.49},
        {close: 83.99, high: 84.3, low: 82.3},
        {close: 84.55, high: 84.84, low: 84.15},
        {close: 84.36, high: 85.0, low: 84.11},
        {close: 85.53, high: 85.9, low: 84.03},
        {close: 86.54, high: 86.58, low: 85.39},
        {close: 86.89, high: 86.98, low: 85.76},
        {close: 87.77, high: 88.0, low: 87.17},
        {close: 87.29, high: 87.87, low: 87.01},
      ] as const;
      const expectations = [
        '-0.830',
        '0.980',
        '1.330',
        '1.940',
        '1.190',
        '0.700',
        '2.390',
        '2.950',
        '2.310',
        '3.810',
        '4.960',
        '6.090',
        '6.970',
        '6.390',
      ] as const;
      const wad = new WAD();
      const offset = wad.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = wad.add(candle);

        if (result !== null) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(wad.isStable).toBe(true);
      expect(wad.getRequiredInputs()).toBe(2);
    });

    it('keeps the line flat when the close matches the previous close', () => {
      const wad = new WAD();

      wad.add({close: 10, high: 11, low: 9});
      wad.add({close: 12, high: 13, low: 10});

      expect(wad.add({close: 12, high: 14, low: 11})).toBe(2);
    });
  });

  describe('replace', () => {
    it('rolls back the accumulation when an up-close is replaced by a down-close', () => {
      const wad = new WAD();

      wad.add({close: 100, high: 101, low: 99});
      wad.add({close: 102, high: 103, low: 100});

      const originalValue = {close: 105, high: 106, low: 103} as const;
      const replacedValue = {close: 99, high: 104, low: 98} as const;

      const originalResult = wad.add(originalValue);

      expect(originalResult).toBe(5);

      const replacedResult = wad.replace(replacedValue);

      expect(replacedResult).toBe(-3);

      const restoredResult = wad.replace(originalValue);

      expect(restoredResult).toBe(5);
    });

    it('applies the accumulation when a down-close is replaced by an up-close', () => {
      const wad = new WAD();

      wad.add({close: 100, high: 101, low: 99});
      wad.add({close: 98, high: 100, low: 97});

      const originalValue = {close: 96, high: 99, low: 95} as const;
      const replacedValue = {close: 103, high: 104, low: 97} as const;

      const originalResult = wad.add(originalValue);

      expect(originalResult).toBe(-5);

      const replacedResult = wad.replace(replacedValue);

      expect(replacedResult).toBe(4);

      const restoredResult = wad.replace(originalValue);

      expect(restoredResult).toBe(-5);
    });
  });
});

testIndicatorContract({
  create: () => new WAD(),
  divergentInput: {close: 500, high: 500, low: 500},
  inputs: [
    {close: 81.59, high: 82.15, low: 81.29},
    {close: 81.06, high: 81.89, low: 80.64},
    {close: 82.87, high: 83.03, low: 81.31},
    {close: 83.0, high: 83.3, low: 82.65},
  ],
});
