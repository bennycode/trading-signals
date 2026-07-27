import {UltimateOscillator} from './UltimateOscillator.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../base/index.js';

describe('UltimateOscillator', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L440-L444
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
    '43.499',
    '34.044',
    '65.883',
    '73.955',
    '53.388',
    '64.149',
    '81.282',
    '90.186',
    '86.114',
    '65.450',
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const ultosc = new UltimateOscillator({longPeriod: 5, mediumPeriod: 3, shortPeriod: 2});

      ultosc.updates(candles, false);

      const originalValue = {close: 89.0, high: 90.0, low: 88.0} as const;
      const replacedValue = {close: 83.0, high: 84.0, low: 82.0} as const;

      const originalResult = ultosc.add(originalValue);

      expect(originalResult?.toFixed(2)).toBe('59.75');

      const replacedResult = ultosc.replace(replacedValue);

      expect(replacedResult?.toFixed(2)).toBe('26.95');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = ultosc.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      const ultosc = new UltimateOscillator({longPeriod: 5, mediumPeriod: 3, shortPeriod: 2});
      const offset = ultosc.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = ultosc.add(candle);

        if (result) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(ultosc.isStable).toBe(true);
      expect(ultosc.getRequiredInputs()).toBe(6);
    });

    it(
      "reproduces Larry Williams' reference values with the default configuration",
      {tags: ['tulipindicators']},
      () => {
        /*
         * Test data verified with:
         * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/atoz.txt#L252-L258
         */
        const highs = [
          24.4375, 24.3125, 24.8125, 24.875, 24.3125, 24.5, 25.75, 25.5, 26.375, 26.875, 26.25, 26.125, 25.25, 25.625,
          25.75, 25.6875, 24.6875, 24.3125, 24.0, 23.0, 23.25, 22.625, 23.1875, 22.5, 22.5, 22.375, 21.875, 21.5625,
          21.0, 19.75, 21.9375, 22.875, 23.1875, 22.75, 22.0625, 22.1875, 21.75, 21.4375, 22.375, 23.5,
        ] as const;
        const lows = [
          23.75, 23.25, 23.625, 24.125, 23.8125, 23.75, 24.4375, 24.5625, 25.375, 26.0625, 25.6875, 24.5625, 23.875,
          24.75, 25.25, 24.5, 23.125, 23.0625, 23.0, 21.25, 22.125, 20.5625, 21.75, 21.4375, 21.875, 21.6875, 20.4375,
          20.6875, 20.3125, 18.6875, 19.6875, 22.0, 22.375, 22.25, 20.375, 20.5, 20.8125, 20.8125, 20.875, 22.5,
        ] as const;
        const closes = [
          23.875, 23.8125, 24.625, 24.3125, 23.9375, 24.4375, 25.0, 24.875, 26.375, 26.1875, 25.9375, 24.6875, 24.75,
          25.3125, 25.4375, 24.5625, 23.6875, 23.25, 23.0, 22.25, 22.75, 21.25, 22.4375, 21.875, 22.4375, 22.0625,
          21.125, 21.0, 20.5625, 19.3125, 21.9375, 22.125, 22.875, 22.5, 21.9375, 20.75, 21.0, 21.375, 22.1875, 22.8125,
        ] as const;
        const expected = [
          '46.4410',
          '42.7170',
          '55.0644',
          '51.8299',
          '54.2715',
          '54.7001',
          '58.6161',
          '54.9119',
          '54.5148',
          '48.9728',
          '55.3561',
          '53.7807',
        ] as const;

        const ultosc = new UltimateOscillator();
        const offset = ultosc.getRequiredInputs() - 1;

        highs.forEach((high, i) => {
          const result = ultosc.add({close: closes[i], high, low: lows[i]});

          if (result) {
            expect(result.toFixed(4)).toBe(expected[i - offset]);
          }
        });

        expect(ultosc.isStable).toBe(true);
        expect(ultosc.getRequiredInputs()).toBe(29);
      }
    );

    it('returns a neutral index when the short window has no true range', () => {
      const ultosc = new UltimateOscillator({longPeriod: 5, mediumPeriod: 3, shortPeriod: 2});
      const flatCandle = {close: 50, high: 50, low: 50} as const;

      for (let i = 0; i < 6; i++) {
        ultosc.add(flatCandle);
      }

      expect(ultosc.getResultOrThrow()).toBe(50);
    });

    it('throws an error when there is not enough input data', () => {
      const ultosc = new UltimateOscillator();

      try {
        ultosc.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const ultosc = new UltimateOscillator();

      expect(ultosc.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when every candle closes at the top of an expanding range', () => {
      const ultosc = new UltimateOscillator({longPeriod: 5, mediumPeriod: 3, shortPeriod: 2});

      for (let i = 0; i < 6; i++) {
        ultosc.add({close: 12 + i, high: 12 + i, low: 10 + i});
      }

      expect(ultosc.getResultOrThrow()).toBe(100);
      expect(ultosc.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when every candle closes at the bottom of a falling range', () => {
      const ultosc = new UltimateOscillator({longPeriod: 5, mediumPeriod: 3, shortPeriod: 2});

      for (let i = 0; i < 6; i++) {
        ultosc.add({close: 50 - i, high: 52 - i, low: 50 - i});
      }

      expect(ultosc.getResultOrThrow()).toBe(0);
      expect(ultosc.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the oscillator is between the oversold and overbought thresholds', () => {
      const ultosc = new UltimateOscillator({longPeriod: 5, mediumPeriod: 3, shortPeriod: 2});
      const flatCandle = {close: 50, high: 50, low: 50} as const;

      for (let i = 0; i < 6; i++) {
        ultosc.add(flatCandle);
      }

      expect(ultosc.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const config = {longPeriod: 5, mediumPeriod: 3, shortPeriod: 2} as const;
      const sensitiveBull = new UltimateOscillator(config, {overbought: 45});
      const sensitiveBear = new UltimateOscillator(config, {oversold: 55});
      const flatCandle = {close: 50, high: 50, low: 50} as const;

      for (let i = 0; i < 6; i++) {
        sensitiveBull.add(flatCandle);
        sensitiveBear.add(flatCandle);
      }

      expect(sensitiveBull.getResultOrThrow()).toBe(50);
      expect(sensitiveBull.getSignal().state).toBe(TradingSignal.BULLISH);
      expect(sensitiveBear.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});
