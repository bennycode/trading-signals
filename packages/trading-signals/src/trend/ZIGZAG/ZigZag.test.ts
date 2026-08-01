import {ZigZag} from './ZigZag.js';

describe('ZigZag', () => {
  describe('add', () => {
    it('returns the extreme values when the deviation threshold is met', () => {
      /*
       * Test data verified with:
       * https://github.com/munrocket/ta-math/blob/abdba60394582fa5847f57e87969dcd2d22b6ce8/test/test.js#L306-L308
       */
      const highs = [
        -8, -4, -1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 22, 33, 44, 55, 66, 77, 88, 88, 71, 61, 51, 41, 51, 61, 71, 81, 91,
        11,
      ] as const;

      const lows = [
        -9, -5, -2, 8, 7, 6, 5, 4, 3, 2, 1, 0, 10, 20, 30, 40, 50, 60, 70, 80, 85, 70, 60, 50, 40, 50, 60, 70, 80, 90,
        10,
      ] as const;

      const expected = [-9, 9, 0, 88, 40, 91] as const;

      const deviation = 15;

      const zigzag = new ZigZag({deviation});

      const candles = highs.map((high, index) => {
        return {
          high,
          low: lows[index],
        };
      });

      const results = [];

      for (const candle of candles) {
        const result = zigzag.add(candle);
        if (result !== null) {
          results.push(result);
        }
      }

      expect(results).toEqual(expected);
    });
  });

  describe('replace', () => {
    const highs = [
      -8, -4, -1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 22, 33, 44, 55, 66, 77, 88, 88, 71, 61, 51, 41, 51, 61, 71, 81, 91,
    ] as const;

    const lows = [
      -9, -5, -2, 8, 7, 6, 5, 4, 3, 2, 1, 0, 10, 20, 30, 40, 50, 60, 70, 80, 85, 70, 60, 50, 40, 50, 60, 70, 80, 90,
    ] as const;

    const candles = highs.map((high, index) => ({high, low: lows[index]}));

    function collect(zigzag: ZigZag, inputs: readonly {high: number; low: number}[]) {
      const results: number[] = [];

      for (const candle of inputs) {
        const result = zigzag.add(candle);

        if (result !== null) {
          results.push(result);
        }
      }

      return results;
    }

    it('reproduces an add-only series after a replacement', () => {
      const replaced = new ZigZag({deviation: 15});
      collect(replaced, candles.slice(0, -1));
      replaced.add({high: 500, low: 400});
      replaced.replace(candles[candles.length - 1]);

      const reference = new ZigZag({deviation: 15});
      collect(reference, candles);

      expect(replaced.getResult(), 'a replacement must undo the state the decoy candle left behind').toBe(
        reference.getResult()
      );
    });

    it('treats a replacement before any candle like a first candle', () => {
      const candle = {high: 9, low: -9} as const;

      const replacedFirst = new ZigZag({deviation: 15});
      const addedFirst = new ZigZag({deviation: 15});

      expect(
        replacedFirst.replace(candle),
        'with no candle to roll back to, a replacement is just the first candle'
      ).toBe(addedFirst.add(candle));
    });

    it('changes nothing when the latest candle is replaced with the same values', () => {
      // Swept over every length because the swing state only diverges at some of them.
      for (let length = 1; length <= candles.length; length++) {
        const zigzag = new ZigZag({deviation: 15});

        collect(zigzag, candles.slice(0, length));

        const resultBefore = zigzag.getResult();

        zigzag.replace(candles[length - 1]);

        expect(zigzag.getResult(), `replacing candle ${length} with itself is a no-op`).toBe(resultBefore);
      }
    });

    it('keeps an earlier pivot when the replaced candle reversed nothing', () => {
      const zigzag = new ZigZag({deviation: 15});

      collect(zigzag, candles.slice(0, 20));

      const pivot = zigzag.getResult();

      expect(pivot, 'the series has already reported a pivot').not.toBeNull();

      // Neither candle reverses the trend, so the earlier pivot stands.
      expect(zigzag.add({high: 89, low: 86}), 'a quiet candle reports nothing').toBeNull();
      expect(zigzag.replace({high: 90, low: 87}), 'nor does its replacement').toBeNull();

      expect(zigzag.getResult(), 'replacing a candle that reported nothing must not drop an older pivot').toBe(pivot);
    });

    it('takes back a pivot when the replacement no longer reverses the trend', () => {
      const zigzag = new ZigZag({deviation: 15});

      collect(zigzag, candles.slice(0, 20));

      const resultBeforeReversal = zigzag.getResult();

      // A deep low reverses the uptrend and reports the highest extreme as a pivot.
      expect(zigzag.add({high: 88, low: 10}), 'a deep low ends the uptrend and emits the swing high').toBe(88);

      // Replacing it with a quiet candle means no reversal happened after all.
      zigzag.replace({high: 88, low: 85});

      expect(zigzag.getResult(), 'the withdrawn pivot must not linger').toBe(resultBeforeReversal);
    });
  });

  describe('getRequiredInputs', () => {
    it('returns the amount of required data needed for a calculation', () => {
      const expected = 1;
      const zigzag = new ZigZag({deviation: 15});
      expect(zigzag.getRequiredInputs()).toBe(expected);
    });
  });
});
