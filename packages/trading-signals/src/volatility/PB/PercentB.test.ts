import {TradingSignal} from '../../base/index.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {BollingerBands} from '../BBANDS/BollingerBands.js';
import {PercentB} from './PercentB.js';

describe('PercentB', () => {
  describe('getResultOrThrow', () => {
    it('is compatible with results derived from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
      /*
       * Tulip Indicators publishes reference bands for "bbands 5 2" but no %B row, so the expectations are
       * derived arithmetically from the published lower and upper bands: %B = (close − lower) / (upper − lower).
       * This repository's Bollinger Bands reproduce exactly that Tulip block (see the BollingerBands test),
       * so the derivation carries over one to one:
       *
       * | Close | Lower  | Upper  | (close − lower) / (upper − lower) | %B   |
       * | ----- | ------ | ------ | --------------------------------- | ---- |
       * | 83.61 | 80.530 | 84.322 | 3.080 / 3.792                     | 0.81 |
       * | 83.15 | 80.987 | 84.489 | 2.163 / 3.502                     | 0.62 |
       * | 82.84 | 82.533 | 83.655 | 0.307 / 1.122                     | 0.27 |
       * | 83.99 | 82.472 | 84.164 | 1.518 / 1.692                     | 0.90 |
       * | 84.55 | 82.418 | 84.838 | 2.132 / 2.420                     | 0.88 |
       * | 84.36 | 82.435 | 85.121 | 1.925 / 2.686                     | 0.72 |
       * | 85.53 | 82.511 | 85.997 | 3.019 / 3.486                     | 0.87 |
       * | 86.54 | 83.143 | 86.845 | 3.397 / 3.702                     | 0.92 |
       * | 86.89 | 83.536 | 87.612 | 3.354 / 4.076                     | 0.82 |
       * | 87.77 | 83.870 | 88.566 | 3.900 / 4.696                     | 0.83 |
       * | 87.29 | 85.289 | 88.319 | 2.001 / 3.030                     | 0.66 |
       *
       * Tulip rounds its bands to three decimals, which shifts the derived %B in the third decimal, so the
       * assertions compare two decimals.
       *
       * @see https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L86-L90
       */
      const closes = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expectations = [
        '0.81',
        '0.62',
        '0.27',
        '0.90',
        '0.88',
        '0.72',
        '0.87',
        '0.92',
        '0.82',
        '0.83',
        '0.66',
      ] as const;
      const percentB = new PercentB({deviationMultiplier: 2, interval: 5});
      const offset = percentB.getRequiredInputs() - 1;

      closes.forEach((close, i) => {
        const result = percentB.add(close);

        if (result !== null) {
          expect(result.toFixed(2)).toBe(expectations[i - offset]);
        }
      });

      expect(percentB.isStable).toBe(true);
    });

    it('locates the close within a live set of Bollinger Bands', () => {
      const closes = [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36] as const;
      const percentB = new PercentB({deviationMultiplier: 2, interval: 5});
      const bollingerBands = new BollingerBands(5, 2);

      for (const close of closes) {
        const result = percentB.add(close);
        const bands = bollingerBands.add(close);

        if (result !== null && bands !== null) {
          expect(result).toBe((close - bands.lower) / (bands.upper - bands.lower));
        }
      }

      expect(percentB.isStable).toBe(true);
    });

    it('reads 1 when the close sits exactly on the upper band', () => {
      /*
       * Four identical closes plus one outlier land the outlier exactly on a band: with five values the
       * window's standard deviation is two fifths of the outlier's distance from the cluster and the average
       * moves one fifth of it, so two standard deviations on top of the average reach the outlier exactly.
       */
      const percentB = new PercentB({interval: 5});
      const closes = [10, 10, 10, 10] as const;

      for (const close of closes) {
        percentB.add(close);
      }

      expect(percentB.add(20)).toBe(1);
    });

    it('reads 0 when the close sits exactly on the lower band', () => {
      // Mirror case: the outlier below the cluster lands exactly on the lower band
      const percentB = new PercentB({interval: 5});
      const closes = [10, 10, 10, 10] as const;

      for (const close of closes) {
        percentB.add(close);
      }

      expect(percentB.add(0)).toBe(0);
    });

    it('exceeds 1 when the close breaks above the upper band', () => {
      /*
       * %B is not clamped. Halving the band distance to one standard deviation leaves the same outlier 50%
       * beyond the band, so the reading overshoots to exactly 1.5.
       */
      const percentB = new PercentB({deviationMultiplier: 1, interval: 5});
      const closes = [10, 10, 10, 10] as const;

      for (const close of closes) {
        percentB.add(close);
      }

      expect(percentB.add(20)).toBe(1.5);
    });

    it('falls below 0 when the close breaks below the lower band', () => {
      const percentB = new PercentB({deviationMultiplier: 1, interval: 5});
      const closes = [10, 10, 10, 10] as const;

      for (const close of closes) {
        percentB.add(close);
      }

      expect(percentB.add(0)).toBe(-0.5);
    });

    it('reads neutral in a completely flat market', () => {
      const percentB = new PercentB({interval: 5});

      for (let i = 0; i < 5; i++) {
        percentB.add(10);
      }

      expect(percentB.getResultOrThrow()).toBe(0.5);
      expect(percentB.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });

  describe('getRequiredInputs', () => {
    it('measures 20 closes by default', () => {
      const percentB = new PercentB();

      expect(percentB.getRequiredInputs()).toBe(20);
    });

    it('matches the configured interval', () => {
      const percentB = new PercentB({interval: 5});

      expect(percentB.getRequiredInputs()).toBe(5);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const percentB = new PercentB({interval: 5});
      const closes = [10, 10, 10, 10] as const;

      for (const close of closes) {
        percentB.add(close);
      }

      const originalValue = 20;
      const replacedValue = 0;

      const originalResult = percentB.add(originalValue);

      expect(originalResult).toBe(1);

      const replacedResult = percentB.replace(replacedValue);

      expect(replacedResult).toBe(0);

      const restoredResult = percentB.replace(originalValue);

      expect(restoredResult).toBe(1);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const percentB = new PercentB({interval: 5});
      const signal = percentB.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });

    it('returns BULLISH when the close presses above the upper band', () => {
      const percentB = new PercentB({interval: 5});
      const closes = [10, 10, 10, 10, 20] as const;

      for (const close of closes) {
        percentB.add(close);
      }

      expect(percentB.getResultOrThrow()).toBe(1);

      const signal = percentB.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns BEARISH when the close presses below the lower band', () => {
      const percentB = new PercentB({interval: 5});
      const closes = [10, 10, 10, 10, 0] as const;

      for (const close of closes) {
        percentB.add(close);
      }

      expect(percentB.getResultOrThrow()).toBe(0);

      const signal = percentB.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns SIDEWAYS while the close stays inside the bands', () => {
      const percentB = new PercentB({interval: 5});
      const closes = [10, 11, 12, 13, 14] as const;

      for (const close of closes) {
        percentB.add(close);
      }

      expect(percentB.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags a signal change when the close breaks out of the bands', () => {
      const percentB = new PercentB({interval: 5});

      for (let i = 0; i < 6; i++) {
        percentB.add(10);
      }

      expect(percentB.getSignal()).toEqual({hasChanged: false, state: TradingSignal.SIDEWAYS});

      percentB.add(20);

      expect(percentB.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});
    });

    it('restores the previous signal state on replace', () => {
      const percentB = new PercentB({interval: 5});

      for (let i = 0; i < 6; i++) {
        percentB.add(10);
      }

      percentB.add(20);

      expect(percentB.getSignal().state).toBe(TradingSignal.BULLISH);

      percentB.replace(10);

      expect(percentB.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('respects custom overbought and oversold thresholds', () => {
      const signalThresholds = {overbought: 0.8, oversold: 0.2} as const;
      const rising = new PercentB({interval: 5, signalThresholds});
      const falling = new PercentB({interval: 5, signalThresholds});

      for (const close of [10, 11, 12, 13, 14] as const) {
        rising.add(close);
      }

      expect(rising.getSignal().state).toBe(TradingSignal.BULLISH);

      for (const close of [14, 13, 12, 11, 10] as const) {
        falling.add(close);
      }

      expect(falling.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});

testIndicatorContract({
  create: () => new PercentB({deviationMultiplier: 2, interval: 5}),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15],
});
