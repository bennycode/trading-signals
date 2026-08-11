import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {AccumulativeSwingIndex} from './AccumulativeSwingIndex.js';
import {SwingIndex} from './SwingIndex.js';

/**
 * Hand-derived worksheet following Wilder's published calculation ("New Concepts in Technical
 * Trading Systems", 1978). Bar 2 gaps up (the jump to the high dominates), bar 3 gaps down (the
 * jump to the low dominates) and bar 4 spans a wide range (the candle's own range dominates), so
 * every case of Wilder's "R" weighting is exercised. A limit move of 128 keeps every expected
 * value exact in floating point.
 */
const worksheetCandles = [
  {close: 100, high: 102, low: 90, open: 92},
  {close: 114, high: 116, low: 104, open: 106},
  {close: 100, high: 110, low: 98, open: 108},
  {close: 108, high: 112, low: 96, open: 102},
] as const;

const worksheetLimitMove = 128;

describe('SwingIndex', () => {
  describe('add', () => {
    it('weighs the swing against the jump to the high when the bar gaps above the previous close', () => {
      const si = new SwingIndex(worksheetLimitMove);

      si.add({close: 100, high: 102, low: 90, open: 92});

      expect(si.add({close: 114, high: 116, low: 104, open: 106})).toBe(7.8125);
    });

    it('weighs the swing against the jump to the low when the bar gaps below the previous close', () => {
      const si = new SwingIndex(worksheetLimitMove);

      si.add({close: 114, high: 116, low: 104, open: 106});

      expect(si.add({close: 100, high: 110, low: 98, open: 108})).toBe(-6.25);
    });

    it('weighs the swing against the candle range when it dominates both jumps', () => {
      const si = new SwingIndex(worksheetLimitMove);

      si.add({close: 100, high: 110, low: 98, open: 108});

      expect(si.add({close: 108, high: 112, low: 96, open: 102})).toBe(2.34375);
    });

    it('scores the swing of every candle after the first', () => {
      const expectations = [null, 7.8125, -6.25, 2.34375] as const;
      const si = new SwingIndex(worksheetLimitMove);

      worksheetCandles.forEach((candle, i) => {
        const result = si.add(candle);

        expect(result).toBe(expectations[i]);
      });

      expect(si.isStable).toBe(true);
      expect(si.getRequiredInputs()).toBe(2);
    });

    it('reads zero when consecutive candles are completely flat', () => {
      const flatCandle = {close: 100, high: 100, low: 100, open: 100} as const;
      const si = new SwingIndex();

      si.add(flatCandle);

      expect(si.add(flatCandle)).toBe(0);
    });

    it('defaults the limit move to 300', () => {
      const implicitLimit = new SwingIndex();
      const explicitLimit = new SwingIndex(300);

      for (const candle of worksheetCandles) {
        implicitLimit.add(candle);
        explicitLimit.add(candle);
      }

      expect(implicitLimit.getResultOrThrow()).toBe(explicitLimit.getResultOrThrow());
    });

    it('halves every reading when the limit move doubles', () => {
      const tightLimit = new SwingIndex(64);
      const wideLimit = new SwingIndex(128);

      for (const candle of worksheetCandles) {
        tightLimit.add(candle);
        wideLimit.add(candle);
      }

      expect(tightLimit.getResultOrThrow()).toBe(2 * wideLimit.getResultOrThrow());
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const si = new SwingIndex(worksheetLimitMove);

      si.add({close: 100, high: 102, low: 90, open: 92});
      si.add({close: 114, high: 116, low: 104, open: 106});

      const originalValue = {close: 100, high: 110, low: 98, open: 108} as const;
      const replacedValue = {close: 128, high: 130, low: 118, open: 122} as const;

      const originalResult = si.add(originalValue);

      expect(originalResult).toBe(-6.25);

      const replacedResult = si.replace(replacedValue);

      expect(replacedResult).toBe(7.421875);

      const restoredResult = si.replace(originalValue);

      expect(restoredResult).toBe(-6.25);
    });
  });
});

describe('AccumulativeSwingIndex', () => {
  describe('add', () => {
    it('accumulates every swing into a running total', () => {
      const expectations = [null, 7.8125, 1.5625, 3.90625] as const;
      const asi = new AccumulativeSwingIndex(worksheetLimitMove);

      worksheetCandles.forEach((candle, i) => {
        const result = asi.add(candle);

        expect(result).toBe(expectations[i]);
      });

      expect(asi.isStable).toBe(true);
      expect(asi.getRequiredInputs()).toBe(2);
    });

    it('keeps the running total at zero while candles show no swing', () => {
      const flatCandle = {close: 100, high: 100, low: 100, open: 100} as const;
      const asi = new AccumulativeSwingIndex();

      asi.add(flatCandle);
      asi.add(flatCandle);

      expect(asi.add(flatCandle)).toBe(0);
    });
  });

  describe('replace', () => {
    it('rebuilds the running total from before the replaced candle', () => {
      const asi = new AccumulativeSwingIndex(worksheetLimitMove);

      asi.add({close: 100, high: 102, low: 90, open: 92});
      asi.add({close: 114, high: 116, low: 104, open: 106});

      const originalValue = {close: 100, high: 110, low: 98, open: 108} as const;
      const replacedValue = {close: 128, high: 130, low: 118, open: 122} as const;

      const originalResult = asi.add(originalValue);

      expect(originalResult).toBe(1.5625);

      const replacedResult = asi.replace(replacedValue);

      expect(replacedResult).toBe(15.234375);

      const restoredResult = asi.replace(originalValue);

      expect(restoredResult).toBe(1.5625);
    });

    it('supports replacing a candle while still warming up', () => {
      const asi = new AccumulativeSwingIndex(worksheetLimitMove);

      asi.add({close: 50, high: 55, low: 45, open: 48});

      expect(asi.replace({close: 100, high: 102, low: 90, open: 92})).toBeNull();
      expect(asi.add({close: 114, high: 116, low: 104, open: 106})).toBe(7.8125);
    });
  });
});

testIndicatorContract({
  create: () => new SwingIndex(worksheetLimitMove),
  divergentInput: {close: 128, high: 130, low: 118, open: 122},
  inputs: worksheetCandles,
});

testIndicatorContract({
  create: () => new AccumulativeSwingIndex(worksheetLimitMove),
  divergentInput: {close: 128, high: 130, low: 118, open: 122},
  inputs: worksheetCandles,
});
