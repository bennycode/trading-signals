import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {QQE} from './QQE.js';
import {TradingSignal} from '../../base/index.js';

describe('QQE', () => {
  const config = {fastFactor: 1, rsiInterval: 2, smoothInterval: 2} as const;
  /*
   * Zigzag warm-up, climb, crash and V-shaped recovery, so the trailing stop ratchets on both
   * sides and flips in both directions.
   */
  const prices = [81, 83, 82, 84, 83, 85, 86, 88, 90, 92, 84, 74, 70, 68, 80, 90, 89, 91] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const qqe = new QQE(config);

      for (const price of prices) {
        qqe.add(price);
      }

      const originalValue = 94;
      const replacedValue = 60;

      const originalResult = qqe.add(originalValue);

      expect(originalResult?.rsiMa.toFixed(4)).toBe('89.6587');
      expect(originalResult?.trailingStop.toFixed(4)).toBe('78.5118');
      expect(qqe.getSignal().state).toBe(TradingSignal.BULLISH);

      const replacedResult = qqe.replace(replacedValue);

      expect(replacedResult?.rsiMa.toFixed(4)).toBe('33.7798');
      expect(replacedResult?.trailingStop.toFixed(4)).toBe('56.0174');
      expect(qqe.getSignal().state).toBe(TradingSignal.BEARISH);

      const restoredResult = qqe.replace(originalValue);

      expect(restoredResult).toEqual(originalResult);
      expect(qqe.getSignal().state).toBe(TradingSignal.BULLISH);
    });
  });

  describe('getRequiredInputs', () => {
    it('requires 72 candles with the documented default configuration', () => {
      const qqe = new QQE();

      expect(qqe.getRequiredInputs()).toBe(72);
      expect(qqe.fastFactor).toBe(4.236);
      expect(qqe.rsiInterval).toBe(14);
      expect(qqe.smoothInterval).toBe(5);
    });
  });

  describe('getResultOrThrow', () => {
    /*
     * Formula from Roman Ignatov's QQE for MetaTrader 4, as formulated by its open-source
     * TradingView ports (RSI smoothed by an EMA, its absolute change double-smoothed over
     * 2 x RSI interval - 1 readings, scaled bands with SuperTrend-style flips):
     * https://www.tradingview.com/script/0vn4HZ7O-Quantitative-Qualitative-Estimation-QQE/
     * https://www.tradingview.com/script/34U0KMEK-QQE-MT4-Glaz-modified-by-JustUncleL/
     *
     * External reference fixtures are not reproducible here because every smoothing stage in this
     * library seeds with its first input, so the expectations are hand-derived with the RSI and
     * smoothing intervals set to 2 (Wilder smoothing factor 1/2, EMA weights 2/3 and 1/2), a fast
     * factor of 1, and verified through an independent batch recomputation:
     *
     * price | RSI(2)  | rsiMa    | |change| | EMA(3)   | EMA(3)  | longband | shortband | side | stop
     *    81 | -       | -        | -        | -        | -       | -        | -         | -    | -
     *    83 | -       | -        | -        | -        | -       | -        | -         | -    | -
     *    82 | 66.6667 | 66.6667* | -        | -        | -       | -        | -         | -    | -
     *    84 | 85.7143 | 79.3651  | -        | -        | -       | -        | -         | -    | -
     *    83 | 54.5455 | 62.8187  | 16.5464  | 16.5464* | -       | -        | -         | -    | -
     *    85 | 81.4815 | 75.2605  | 12.4419  | 14.4941  | -       | -        | -         | -    | -
     *    86 | 88.3721 | 84.0016  |  8.7410  | 11.6176  | 11.6176*| -        | -         | -    | -
     *    88 | 95.3271 | 91.5519  |  7.5504  |  9.5840  | 10.6008 | -        | -         | -    | -
     *    90 | 97.8723 | 95.7655  |  4.2136  |  6.8988  |  8.7498 | 87.0158  | 104.5153  | up   | 87.0158
     *    92 | 98.9817 | 97.9096  |  2.1441  |  4.5214  |  6.6356 | 91.2740  | 104.5153  | up   | 91.2740
     *    84 | 19.1414 | 45.3975  | 52.5122  | 28.5168  | 17.5762 | 27.8213  |  62.9737  | down | 62.9737
     *    74 |  6.3455 | 19.3628  | 26.0347  | 27.2757  | 22.4260 | -3.0632  |  41.7888  | down | 41.7888
     *    70 |  4.1344 |  9.2105  | 10.1523  | 18.7140  | 20.5700 | -3.0632  |  29.7805  | down | 29.7805
     *    68 |  3.0661 |  5.1142  |  4.0963  | 11.4052  | 15.9876 | -3.0632  |  21.1018  | down | 21.1018
     *    80 | 76.3626 | 52.6132  | 47.4989  | 29.4521  | 22.7198 | 29.8933  |  75.3330  | up   | 29.8933
     *    90 | 89.5421 | 77.2325  | 24.6193  | 27.0357  | 24.8777 | 52.3547  | 102.1102  | up   | 52.3547
     *    89 | 80.5587 | 79.4500  |  2.2175  | 14.6266  | 19.7522 | 59.6978  |  99.2021  | up   | 59.6978
     *    91 | 86.1263 | 83.9009  |  4.4509  |  9.5387  | 14.6455 | 69.2554  |  98.5463  | up   | 69.2554
     *
     * (*) seed reading: the stage turns stable one reading later and only then feeds the next
     * stage. The bands equal the smoothed RSI plus/minus the last EMA(3) column. The crash bar
     * (84) breaks the long band and flips the side down, after which the short band only
     * ratchets lower and the long band freezes at -3.0632 until the recovery bar (80) breaks
     * the short band and flips the side back up.
     */
    it('trails a stop behind the smoothed RSI and flips sides when the line breaks through it', () => {
      const expectations = [
        ['95.7655', '87.0158'],
        ['97.9096', '91.2740'],
        ['45.3975', '62.9737'],
        ['19.3628', '41.7888'],
        ['9.2105', '29.7805'],
        ['5.1142', '21.1018'],
        ['52.6132', '29.8933'],
        ['77.2325', '52.3547'],
        ['79.4500', '59.6978'],
        ['83.9009', '69.2554'],
      ] as const;
      const qqe = new QQE(config);
      const offset = qqe.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = qqe.add(price);

        if (result) {
          const [expectedRsiMa, expectedTrailingStop] = expectations[i - offset];
          expect(result.rsiMa.toFixed(4)).toBe(expectedRsiMa);
          expect(result.trailingStop.toFixed(4)).toBe(expectedTrailingStop);
        }
      });

      expect(qqe.isStable).toBe(true);
      expect(qqe.getRequiredInputs()).toBe(9);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const qqe = new QQE(config);

      expect(qqe.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when the smoothed RSI holds above its trailing stop', () => {
      const qqe = new QQE(config);

      for (const price of [81, 83, 82, 84, 83, 85, 86, 88, 90] as const) {
        qqe.add(price);
      }

      const result = qqe.getResultOrThrow();

      expect(result.rsiMa).toBeGreaterThan(result.trailingStop);
      expect(qqe.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BULLISH,
      });
    });

    it('returns BEARISH when the smoothed RSI drops below its trailing stop', () => {
      const qqe = new QQE(config);

      for (const price of [81, 83, 82, 84, 83, 85, 86, 88, 90, 92, 84] as const) {
        qqe.add(price);
      }

      const result = qqe.getResultOrThrow();

      expect(result.rsiMa).toBeLessThan(result.trailingStop);
      expect(qqe.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });

    it('returns SIDEWAYS when a dead-flat market pins the trailing stop onto the smoothed RSI', () => {
      const qqe = new QQE(config);

      /*
       * A flat series produces no average loss, which this library's RSI reads as maximal
       * strength (100). A constant smoothed RSI has zero volatility, so both bands collapse
       * onto the line itself and neither side is in control.
       */
      for (let i = 0; i < 12; i++) {
        qqe.add(100);
      }

      expect(qqe.getResultOrThrow()).toEqual({rsiMa: 100, trailingStop: 100});
      expect(qqe.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.SIDEWAYS,
      });
    });

    it('flips from BULLISH to BEARISH and back as the smoothed RSI breaks each side of the stop', () => {
      const qqe = new QQE(config);
      const signals: string[] = [];

      for (const price of prices) {
        qqe.add(price);
        signals.push(qqe.getSignal().state);
      }

      expect(signals).toEqual([
        TradingSignal.UNKNOWN,
        TradingSignal.UNKNOWN,
        TradingSignal.UNKNOWN,
        TradingSignal.UNKNOWN,
        TradingSignal.UNKNOWN,
        TradingSignal.UNKNOWN,
        TradingSignal.UNKNOWN,
        TradingSignal.UNKNOWN,
        TradingSignal.BULLISH,
        TradingSignal.BULLISH,
        TradingSignal.BEARISH,
        TradingSignal.BEARISH,
        TradingSignal.BEARISH,
        TradingSignal.BEARISH,
        TradingSignal.BULLISH,
        TradingSignal.BULLISH,
        TradingSignal.BULLISH,
        TradingSignal.BULLISH,
      ]);
    });

    it('reports a signal change only when the smoothed RSI switches sides', () => {
      const qqe = new QQE(config);

      for (const price of [81, 83, 82, 84, 83, 85, 86, 88, 90, 92] as const) {
        qqe.add(price);
      }

      expect(qqe.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BULLISH,
      });

      qqe.add(84);

      expect(qqe.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });

      qqe.add(74);

      expect(qqe.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BEARISH,
      });
    });
  });
});

testIndicatorContract({
  create: () => new QQE({fastFactor: 1, rsiInterval: 2, smoothInterval: 2}),
  divergentInput: 1_000,
  inputs: [81, 83, 82, 84, 83, 85, 86, 88, 90, 92, 84, 74, 70, 68, 80, 90, 89, 91],
});
