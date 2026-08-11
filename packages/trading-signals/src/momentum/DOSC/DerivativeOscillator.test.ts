import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {DerivativeOscillator} from './DerivativeOscillator.js';
import {TradingSignal} from '../../base/index.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {SMA} from '../../trend/SMA/SMA.js';
import {RSI} from '../RSI/RSI.js';

describe('DerivativeOscillator', () => {
  const config = {ema1Interval: 2, ema2Interval: 2, rsiInterval: 2, smaInterval: 2} as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const dosc = new DerivativeOscillator(config);
      const prices = [2, 4, 3, 5, 4, 6, 5] as const;

      for (const price of prices) {
        dosc.add(price);
      }

      const originalValue = 9;
      const replacedValue = 1;

      const originalResult = dosc.add(originalValue);

      expect(originalResult?.toFixed(4)).toBe('4.8102');

      const replacedResult = dosc.replace(replacedValue);

      expect(replacedResult?.toFixed(4)).toBe('-11.8240');
      expect(replacedResult).not.toBe(originalResult);

      const restoredResult = dosc.replace(originalValue);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getRequiredInputs', () => {
    it('requires 29 candles with the documented default configuration', () => {
      expect(new DerivativeOscillator().getRequiredInputs()).toBe(29);
    });
  });

  describe('getResultOrThrow', () => {
    /*
     * DOSC = s - SMA(smaInterval, s) where s = EMA(ema2Interval, EMA(ema1Interval, RSI(rsiInterval, close))).
     * Formula from Constance Brown, "Technical Analysis for the Trading Professional" (McGraw-Hill, 1999),
     * as described by TradingView and Fidelity:
     * https://www.tradingview.com/support/solutions/43000502248-derivative-oscillator/
     * https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/derivative-oscillator
     *
     * External reference fixtures are not reproducible here because every smoothing stage in this
     * library seeds with its first input, so the expectations are hand-derived with all intervals
     * set to 2 (Wilder smoothing factor 1/2, EMA weight 2/3):
     *
     * price | RSI(2)  | EMA(2)   | EMA(2) = s | SMA(2, s) | DOSC = s - SMA
     *     2 | -       | -        | -          | -         | -
     *     4 | -       | -        | -          | -         | -
     *     3 | 66.6667 | 66.6667* | -          | -         | -
     *     5 | 85.7143 | 79.3651  | 79.3651*   | -         | -
     *     4 | 54.5455 | 62.8187  | 68.3341    | -         | -
     *     6 | 81.4815 | 75.2605  | 72.9517    | 70.6429   | 2.3088
     *     5 | 51.1628 | 59.1954  | 63.7808    | 68.3663   | -4.5855
     *
     * (*) seed reading: the stage turns stable one reading later and only then feeds the next stage.
     */
    it('calculates the histogram according to the hand-derived worksheet', () => {
      const prices = [2, 4, 3, 5, 4, 6, 5] as const;
      const expectations = ['2.3088', '-4.5855'] as const;
      const dosc = new DerivativeOscillator(config);
      const offset = dosc.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = dosc.add(price);

        if (result) {
          expect(result.toFixed(4)).toBe(expectations[i - offset]);
        }
      });

      expect(dosc.isStable).toBe(true);
      expect(dosc.getRequiredInputs()).toBe(6);
    });

    it('equals a staged composition of the RSI, EMA and SMA components it is built from', () => {
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29, 86.5,
        85.8, 86.2, 87.1, 88.3, 89.0, 88.4, 87.6, 88.1, 89.4, 90.2, 89.8, 90.5, 91.1, 90.7, 89.9, 90.3, 91.4, 92.0,
      ] as const;
      const dosc = new DerivativeOscillator();
      const rsi = new RSI(14);
      const firstSmoothing = new EMA(5);
      const secondSmoothing = new EMA(3);
      const signalLine = new SMA(9);

      // Every stage starts feeding the next one only once it is stable itself.
      const composeExpected = (price: number) => {
        rsi.add(price);
        const rsiResult = rsi.getResult();

        if (rsiResult === null) {
          return null;
        }

        firstSmoothing.add(rsiResult);
        const onceSmoothed = firstSmoothing.getResult();

        if (onceSmoothed === null) {
          return null;
        }

        secondSmoothing.add(onceSmoothed);
        const smoothedRsi = secondSmoothing.getResult();

        if (smoothedRsi === null) {
          return null;
        }

        const signal = signalLine.add(smoothedRsi);

        if (signal === null) {
          return null;
        }

        return smoothedRsi - signal;
      };

      let emissions = 0;

      for (const price of prices) {
        const expected = composeExpected(price);

        expect(dosc.add(price)).toBe(expected);

        if (expected !== null) {
          emissions += 1;
        }
      }

      expect(emissions).toBe(prices.length - dosc.getRequiredInputs() + 1);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const dosc = new DerivativeOscillator(config);

      expect(dosc.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when the smoothed RSI pulls above its signal line', () => {
      const prices = [2, 4, 3, 5, 4, 6] as const;
      const dosc = new DerivativeOscillator(config);

      for (const price of prices) {
        dosc.add(price);
      }

      expect(dosc.getResultOrThrow()).toBeGreaterThan(0);
      expect(dosc.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BULLISH,
      });
    });

    it('returns BEARISH when the smoothed RSI drops below its signal line', () => {
      const prices = [2, 4, 3, 5, 4, 6, 5] as const;
      const dosc = new DerivativeOscillator(config);

      for (const price of prices) {
        dosc.add(price);
      }

      expect(dosc.getResultOrThrow()).toBeLessThan(0);
      expect(dosc.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });

    it('returns SIDEWAYS when a flat market keeps the histogram on the zero line', () => {
      const dosc = new DerivativeOscillator(config);

      /*
       * A flat series produces no average loss, which this library's RSI reads as maximal
       * strength (100). Smoothing a constant reproduces the constant, so the double smoothed
       * RSI and its signal line coincide and the histogram rests exactly on the zero line.
       */
      for (let i = 0; i < 6; i++) {
        dosc.add(100);
      }

      expect(dosc.getResultOrThrow()).toBe(0);
      expect(dosc.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.SIDEWAYS,
      });
    });

    it('reports a signal change only when the histogram crosses the zero line', () => {
      const prices = [2, 4, 3, 5, 4, 6] as const;
      const dosc = new DerivativeOscillator(config);

      for (const price of prices) {
        dosc.add(price);
      }

      expect(dosc.getSignal().state).toBe(TradingSignal.BULLISH);

      dosc.add(5);

      expect(dosc.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });

      dosc.add(4);

      expect(dosc.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BEARISH,
      });
    });
  });
});

testIndicatorContract({
  create: () => new DerivativeOscillator({ema1Interval: 2, ema2Interval: 2, rsiInterval: 2, smaInterval: 2}),
  divergentInput: 1_000,
  inputs: [2, 4, 3, 5, 4, 6, 5],
});
