import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {MassIndex} from './MassIndex.js';

describe('MassIndex', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/atoz.txt#L141-L145
   * (from "Technical Analysis from A to Z" by Steven B. Achelis, page 182)
   */
  const candles = [
    {high: 38.125, low: 37.75},
    {high: 38, low: 37.75},
    {high: 37.9375, low: 37.8125},
    {high: 37.875, low: 37.625},
    {high: 38.125, low: 37.5},
    {high: 38.125, low: 37.5},
    {high: 37.75, low: 37.5},
    {high: 37.625, low: 37.4375},
    {high: 37.6875, low: 37.375},
    {high: 37.5, low: 37.375},
    {high: 37.5625, low: 37.375},
    {high: 37.625, low: 36.8125},
    {high: 36.6875, low: 36.3125},
    {high: 36.875, low: 36.25},
    {high: 36.9375, low: 36.5},
    {high: 36.5, low: 36.25},
    {high: 36.9375, low: 36.3125},
    {high: 37, low: 36.625},
    {high: 36.875, low: 36.5625},
    {high: 36.8125, low: 36.375},
  ] as const;
  const expectations = ['3.2240', '3.1175'] as const;

  describe('constructor', () => {
    it('defaults to the 25-bar summation proposed by Donald Dorsey', () => {
      const mi = new MassIndex();

      expect(mi.interval).toBe(25);
      expect(mi.getRequiredInputs()).toBe(41);
    });
  });

  describe('getRequiredInputs', () => {
    it('needs both nine-bar smoothing passes plus the summation window to fill', () => {
      const mi = new MassIndex(3);

      expect(mi.getRequiredInputs()).toBe(19);
    });
  });

  describe('getResultOrThrow', () => {
    it('reads a market that never trades a range as no expansion', () => {
      const interval = 3;
      const mi = new MassIndex(interval);

      for (let i = 0; i < 30; i++) {
        mi.add({high: 100, low: 100});
      }

      expect(mi.getResultOrThrow()).toBe(interval);
    });

    it('sums the smoothed range ratios over the interval', {tags: ['tulipindicators']}, () => {
      const mi = new MassIndex(3);
      const offset = mi.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = mi.add(candle);

        if (i < offset) {
          expect(result).toBeNull();
        } else {
          expect(result?.toFixed(4)).toBe(expectations[i - offset]);
        }
      });

      expect(mi.isStable).toBe(true);
    });

    it('yields nothing when the candles run out during the warm-up', {tags: ['tulipindicators']}, () => {
      /*
       * Test data verified with:
       * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L254-L257
       * (Tulip Indicators expects an empty output series for these candles)
       */
      const shortCandles = [
        {high: 82.15, low: 81.29},
        {high: 81.89, low: 80.64},
        {high: 83.03, low: 81.31},
        {high: 83.3, low: 82.65},
        {high: 83.85, low: 83.07},
        {high: 83.9, low: 83.11},
        {high: 83.33, low: 82.49},
        {high: 84.3, low: 82.3},
        {high: 84.84, low: 84.15},
        {high: 85.0, low: 84.11},
        {high: 85.9, low: 84.03},
        {high: 86.58, low: 85.39},
        {high: 86.98, low: 85.76},
        {high: 88.0, low: 87.17},
        {high: 87.87, low: 87.01},
      ] as const;
      const mi = new MassIndex(5);

      for (const candle of shortCandles) {
        expect(mi.add(candle)).toBeNull();
      }

      expect(mi.isStable).toBe(false);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const mi = new MassIndex(3);

      for (const candle of candles.slice(0, -1)) {
        mi.add(candle);
      }

      const originalValue = {high: 36.8125, low: 36.375} as const;
      const replacedValue = {high: 40, low: 35} as const;

      const originalResult = mi.add(originalValue);

      expect(originalResult?.toFixed(4)).toBe('3.1175');

      const replacedResult = mi.replace(replacedValue);

      expect(replacedResult?.toFixed(4)).toBe('4.3610');

      const restoredResult = mi.replace(originalValue);

      expect(restoredResult?.toFixed(4)).toBe('3.1175');
      expect(restoredResult).toBe(originalResult);
    });

    it('rebuilds the same reading when a candle is corrected during the second smoothing warm-up', () => {
      const mi = new MassIndex(3);

      candles.forEach((candle, i) => {
        if (i === 10) {
          mi.add({high: 40, low: 35});
          mi.replace(candle);
        } else {
          mi.add(candle);
        }
      });

      expect(mi.getResultOrThrow().toFixed(4)).toBe('3.1175');
    });
  });
});

testIndicatorContract({
  create: () => new MassIndex(3),
  divergentInput: {high: 40, low: 35},
  inputs: [
    {high: 38.125, low: 37.75},
    {high: 38, low: 37.75},
    {high: 37.9375, low: 37.8125},
    {high: 37.875, low: 37.625},
    {high: 38.125, low: 37.5},
    {high: 38.125, low: 37.5},
    {high: 37.75, low: 37.5},
    {high: 37.625, low: 37.4375},
    {high: 37.6875, low: 37.375},
    {high: 37.5, low: 37.375},
    {high: 37.5625, low: 37.375},
    {high: 37.625, low: 36.8125},
    {high: 36.6875, low: 36.3125},
    {high: 36.875, low: 36.25},
    {high: 36.9375, low: 36.5},
    {high: 36.5, low: 36.25},
    {high: 36.9375, low: 36.3125},
    {high: 37, low: 36.625},
    {high: 36.875, low: 36.5625},
    {high: 36.8125, low: 36.375},
  ],
});
