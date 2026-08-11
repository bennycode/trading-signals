import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {GAPO} from './GAPO.js';

describe('GAPO', () => {
  describe('constructor', () => {
    it('uses an interval of 14 by default', () => {
      const gapo = new GAPO();

      expect(gapo.interval).toBe(14);
      expect(gapo.getRequiredInputs()).toBe(14);
    });

    it('rejects a one-bar window, because the logarithm of 1 is zero and would divide the reading by zero', () => {
      expect(() => new GAPO(1)).toThrow('The interval has to be at least 2, but "1" was given.');
    });
  });

  describe('getResultOrThrow', () => {
    it('relates the trading range of the window to the window length on a log scale', () => {
      /*
       * Hand-derived worksheet following the FM Labs definition
       * (https://www.fmlabs.com/reference/default.htm?url=GAPO.htm), published by
       * Jayanthi Gopalakrishnan in "Technical Analysis of Stocks & Commodities" (January 2000).
       *
       * The ranges are powers of the interval (10), so the expected readings are exact:
       *
       * | Candle | High | Low | Window | Highest High | Lowest Low | Range | log(range) / log(10) |
       * | ------ | ---- | --- | ------ | ------------ | ---------- | ----- | -------------------- |
       * | 1      | 105  | 101 |        |              |            |       |                      |
       * | 2      | 106  | 100 |        |              |            |       |                      |
       * | 3      | 104  | 102 |        |              |            |       |                      |
       * | 4      | 110  | 103 |        |              |            |       |                      |
       * | 5      | 107  | 101 |        |              |            |       |                      |
       * | 6      | 108  | 102 |        |              |            |       |                      |
       * | 7      | 105  | 100 |        |              |            |       |                      |
       * | 8      | 109  | 104 |        |              |            |       |                      |
       * | 9      | 106  | 103 |        |              |            |       |                      |
       * | 10     | 107  | 102 | 1-10   | 110 (#4)     | 100 (#2)   | 10    | 1                    |
       * | 11     | 200  | 150 | 2-11   | 200 (#11)    | 100 (#2)   | 100   | 2                    |
       */
      const candles = [
        {high: 105, low: 101},
        {high: 106, low: 100},
        {high: 104, low: 102},
        {high: 110, low: 103},
        {high: 107, low: 101},
        {high: 108, low: 102},
        {high: 105, low: 100},
        {high: 109, low: 104},
        {high: 106, low: 103},
        {high: 107, low: 102},
        {high: 200, low: 150},
      ] as const;

      const expectations = [1, 2] as const;
      const gapo = new GAPO(10);
      const offset = gapo.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = gapo.add(candle);

        if (result !== null) {
          expect(result).toBe(expectations[i - offset]);
        }
      });

      expect(gapo.isStable).toBe(true);
    });

    it('lets the reading fall once a dominating extreme leaves the window', () => {
      const gapo = new GAPO(10);

      gapo.add({high: 200, low: 100});

      for (let i = 0; i < 8; i++) {
        gapo.add({high: 105, low: 101});
      }

      expect(gapo.add({high: 106, low: 102}), 'the wide candle still dominates the range').toBe(2);
      expect(gapo.add({high: 110, low: 100}), 'the wide candle no longer counts').toBe(1);
    });

    it('reads 0 on a flat window, because a rangeless window carries no range information', () => {
      const gapo = new GAPO(2);

      gapo.add({high: 5, low: 5});

      expect(gapo.add({high: 5, low: 5})).toBe(0);
    });
  });

  describe('update', () => {
    it('replaces the most recently added candle', () => {
      const warmupCandles = [
        {high: 105, low: 101},
        {high: 106, low: 100},
        {high: 104, low: 102},
        {high: 110, low: 103},
        {high: 107, low: 101},
        {high: 108, low: 102},
        {high: 105, low: 100},
        {high: 109, low: 104},
        {high: 106, low: 103},
      ] as const;

      const gapo = new GAPO(10);

      for (const candle of warmupCandles) {
        gapo.add(candle);
      }

      const originalCandle = {high: 107, low: 102} as const;
      const replacedCandle = {high: 200, low: 102} as const;

      const originalResult = gapo.add(originalCandle);

      expect(originalResult).toBe(1);

      const replacedResult = gapo.replace(replacedCandle);

      expect(replacedResult, 'the replaced candle stretches the range tenfold').toBe(2);

      const restoredResult = gapo.replace(originalCandle);

      expect(restoredResult, 'replacing back reproduces the original reading').toBe(1);
    });
  });
});

testIndicatorContract({
  create: () => new GAPO(5),
  divergentInput: {high: 1_000, low: 500},
  inputs: [
    {high: 213.35, low: 211.52},
    {high: 214.22, low: 213.15},
    {high: 214.06, low: 213.02},
    {high: 215.17, low: 213.42},
    {high: 214.53, low: 213.91},
    {high: 214.89, low: 213.52},
  ],
});
