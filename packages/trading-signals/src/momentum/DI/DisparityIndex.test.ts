import {TradingSignal} from '../../base/Indicator.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {EMA} from '../../trend/EMA/EMA.js';
import {SMA} from '../../trend/SMA/SMA.js';
import {DisparityIndex} from './DisparityIndex.js';

describe('DisparityIndex', () => {
  describe('constructor', () => {
    it('defaults to a 14-period simple moving average', () => {
      const defaultInstance = new DisparityIndex();
      const explicitInstance = new DisparityIndex(14, SMA);

      expect(defaultInstance.interval).toBe(14);
      expect(defaultInstance.getRequiredInputs()).toBe(14);

      for (let i = 1; i <= 14; i++) {
        defaultInstance.add(i);
        explicitInstance.add(i);
      }

      expect(defaultInstance.getResultOrThrow()).toBe(explicitInstance.getResultOrThrow());
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the percentage deviation of the close from its simple moving average', () => {
      /*
       * There is no external reference implementation for the Disparity Index, so the expectations
       * are derived arithmetically from the 5-period SMA of the close series used in the Tulip
       * Indicators test data (https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt),
       * applying DI = 100 × (close − SMA) / SMA (https://www.investopedia.com/terms/d/disparityindex.asp):
       *
       * | close | window sum | SMA(5)  | DI = 100 × (close − SMA) / SMA |
       * | ----- | ---------- | ------- | ------------------------------ |
       * | 83.61 | 412.13     | 82.4260 |  1.44                          |
       * | 83.15 | 413.69     | 82.7380 |  0.50                          |
       * | 82.84 | 415.47     | 83.0940 | -0.31                          |
       * | 83.99 | 416.59     | 83.3180 |  0.81                          |
       * | 84.55 | 418.14     | 83.6280 |  1.10                          |
       * | 84.36 | 418.89     | 83.7780 |  0.69                          |
       * | 85.53 | 421.27     | 84.2540 |  1.51                          |
       * | 86.54 | 424.97     | 84.9940 |  1.82                          |
       * | 86.89 | 427.87     | 85.5740 |  1.54                          |
       * | 87.77 | 431.09     | 86.2180 |  1.80                          |
       * | 87.29 | 434.02     | 86.8040 |  0.56                          |
       */
      const closes = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expectations = [
        '1.44',
        '0.50',
        '-0.31',
        '0.81',
        '1.10',
        '0.69',
        '1.51',
        '1.82',
        '1.54',
        '1.80',
        '0.56',
      ] as const;
      const di = new DisparityIndex(5);
      const offset = di.getRequiredInputs() - 1;

      closes.forEach((close, i) => {
        const result = di.add(close);

        if (result !== null) {
          expect(result.toFixed(2)).toBe(expectations[i - offset]);
        }
      });

      expect(di.isStable).toBe(true);
    });

    it('supports swapping the smoothing moving average', () => {
      const closes = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const di = new DisparityIndex(5, EMA);
      const ema = new EMA(5);

      for (const close of closes) {
        di.add(close);
        ema.add(close);
      }

      const average = ema.getResultOrThrow();
      const expected = (100 * (closes[closes.length - 1] - average)) / average;

      expect(di.getResultOrThrow()).toBe(expected);
    });

    it('reports the neutral zero line when the moving average is zero', () => {
      const di = new DisparityIndex(5);

      for (let i = 0; i < 5; i++) {
        di.add(0);
      }

      expect(di.getResultOrThrow()).toBe(0);
      expect(di.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      /*
       * Derived from the reference table above: the original close of 83.61 completes the window
       * summing to 412.13 (SMA 82.426, DI 1.44). Replacing it with 90 changes the sum to 418.52
       * (SMA 83.704, DI = 100 × (90 − 83.704) / 83.704 = 7.52).
       */
      const closes = [81.59, 81.06, 82.87, 83.0] as const;
      const di = new DisparityIndex(5);

      for (const close of closes) {
        di.add(close);
      }

      const originalResult = di.add(83.61);
      const replacedResult = di.replace(90);

      expect(originalResult?.toFixed(2)).toBe('1.44');
      expect(replacedResult?.toFixed(2)).toBe('7.52');

      const restoredResult = di.replace(83.61);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN without a change while warming up', () => {
      const di = new DisparityIndex(5);

      di.add(81.59);

      const signal = di.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });

    it('returns BULLISH when the close trades above its average', () => {
      const closes = [10, 20, 30, 40, 50] as const;
      const di = new DisparityIndex(5);

      for (const close of closes) {
        di.add(close);
      }

      const signal = di.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns BEARISH when the close trades below its average', () => {
      const closes = [50, 40, 30, 20, 10] as const;
      const di = new DisparityIndex(5);

      for (const close of closes) {
        di.add(close);
      }

      const signal = di.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns SIDEWAYS when a flat series keeps the close on its average', () => {
      const closes = [100, 100, 100, 100, 100] as const;
      const di = new DisparityIndex(5);

      for (const close of closes) {
        di.add(close);
      }

      expect(di.getResultOrThrow()).toBe(0);

      const signal = di.getSignal();

      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
      expect(signal.hasChanged).toBe(true);
    });

    it('flags a change only when the signal flips', () => {
      const closes = [100, 100, 100, 100, 100] as const;
      const di = new DisparityIndex(5);

      for (const close of closes) {
        di.add(close);
      }

      di.add(100);

      expect(di.getSignal()).toStrictEqual({hasChanged: false, state: TradingSignal.SIDEWAYS});

      di.add(110);

      expect(di.getSignal()).toStrictEqual({hasChanged: true, state: TradingSignal.BULLISH});
    });
  });
});

testIndicatorContract({
  create: () => new DisparityIndex(5),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84],
});
