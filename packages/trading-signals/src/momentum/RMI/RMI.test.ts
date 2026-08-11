import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {RMI} from './RMI.js';
import {RSI} from '../RSI/RSI.js';
import {TradingSignal} from '../../base/index.js';

describe('RMI', () => {
  /*
   * Hand-derived worksheet for Roger Altman's RMI (Technical Analysis of Stocks & Commodities,
   * February 1993) with a 2-bar momentum span and 3-bar Wilder smoothing.
   *
   * "U" is the close's gain over the close from 2 bars back, "D" its loss. Both averages seed
   * with the plain average of their first 3 inputs and continue as avg + (x - avg) / 3. On bar 5
   * no down-momentum exists yet, which reads 100 like the RSI.
   *
   * bar | close | close 2 back | U | D |   avgU |   avgD | RMI = 100 × avgU / (avgU + avgD)
   *   1 |    10 |            - | - | - |      - |      - |      -
   *   2 |    12 |            - | - | - |      - |      - |      -
   *   3 |    11 |           10 | 1 | 0 |      - |      - |      -
   *   4 |    13 |           12 | 1 | 0 |      - |      - |      -
   *   5 |    14 |           11 | 3 | 0 | 1.6667 |      0 | 100.00
   *   6 |    12 |           13 | 0 | 1 | 1.1111 | 0.3333 |  76.92
   *   7 |    15 |           14 | 1 | 0 | 1.0741 | 0.2222 |  82.86
   *   8 |    13 |           12 | 1 | 0 | 1.0494 | 0.1481 |  87.63
   */
  const prices = [10, 12, 11, 13, 14, 12, 15, 13] as const;
  const expectations = ['100.00', '76.92', '82.86', '87.63'] as const;

  describe('getResultOrThrow', () => {
    it('matches the hand-derived Altman worksheet', () => {
      const rmi = new RMI({interval: 3, momentum: 2});
      const offset = rmi.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = rmi.add(price);

        if (result) {
          expect(result.toFixed(2)).toBe(expectations[i - offset]);
        }
      });

      expect(rmi.isStable).toBe(true);
    });

    it(
      'degenerates into a bitwise-identical RSI when the momentum span is a single bar',
      {tags: ['tulipindicators']},
      () => {
        /*
         * With a one-bar span the momentum streams equal the RSI's gain and loss streams, so every
         * reading must reproduce the Tulip-verified RSI exactly. Test data verified with:
         * https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L347-L349
         */
        const closes = [
          81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
        ] as const;
        const tulipExpectations = [
          '72.034',
          '64.927',
          '75.936',
          '79.796',
          '74.713',
          '83.033',
          '87.478',
          '88.755',
          '91.483',
          '78.498',
        ] as const;
        const rmi = new RMI({interval: 5, momentum: 1});
        const rsi = new RSI(5);
        const offset = rmi.getRequiredInputs() - 1;

        closes.forEach((close, i) => {
          const result = rmi.add(close);
          rsi.add(close);

          if (result) {
            expect(result).toBe(rsi.getResultOrThrow());
            expect(result.toFixed(3)).toBe(tulipExpectations[i - offset]);
          }
        });

        expect(rmi.isStable).toBe(true);
      }
    );

    it('reads 100 in a dead market, matching the RSI', () => {
      const rmi = new RMI({interval: 3, momentum: 2});
      const rsi = new RSI(3);

      for (let i = 0; i < 5; i++) {
        rmi.add(100);
        rsi.add(100);
      }

      expect(rmi.getResultOrThrow()).toBe(100);
      expect(rmi.getResultOrThrow()).toBe(rsi.getResultOrThrow());
    });
  });

  describe('getRequiredInputs', () => {
    it('spans the momentum lag plus the smoothing warm-up', () => {
      expect(new RMI().getRequiredInputs()).toBe(19);
      expect(new RMI({interval: 3, momentum: 2}).getRequiredInputs()).toBe(5);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const rmi = new RMI({interval: 3, momentum: 2});

      for (const price of prices) {
        rmi.add(price);
      }

      // Swinging the bar from an up-move to a down-move rolls back the lagged closes and both smoothings
      const originalResult = rmi.add(16);

      expect(originalResult?.toFixed(2)).toBe('91.27');

      const replacedResult = rmi.replace(9);

      expect(replacedResult?.toFixed(2)).toBe('25.00');

      const restoredResult = rmi.replace(16);

      expect(restoredResult).toBe(originalResult);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const rmi = new RMI({interval: 3, momentum: 2});

      expect(rmi.getSignal().state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when the market shows only up-momentum', () => {
      const rmi = new RMI({interval: 3, momentum: 2});

      for (const price of [1, 2, 3, 4, 5] as const) {
        rmi.add(price);
      }

      expect(rmi.getResultOrThrow()).toBe(100);
      expect(rmi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the market shows only down-momentum', () => {
      const rmi = new RMI({interval: 3, momentum: 2});

      for (const price of [9, 8, 7, 6, 5] as const) {
        rmi.add(price);
      }

      expect(rmi.getResultOrThrow()).toBe(0);
      expect(rmi.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the momentum mix sits between the thresholds', () => {
      const rmi = new RMI({interval: 3, momentum: 2});

      for (const price of [...prices, 12] as const) {
        rmi.add(price);
      }

      expect(rmi.getResultOrThrow().toFixed(2)).toBe('38.90');
      expect(rmi.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('treats a reading exactly on the overbought threshold as BULLISH', () => {
      const rmi = new RMI({interval: 3, momentum: 2, signalThresholds: {overbought: 100}});

      for (const price of [1, 2, 3, 4, 5] as const) {
        rmi.add(price);
      }

      expect(rmi.getResultOrThrow()).toBe(100);
      expect(rmi.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('treats a reading exactly on the oversold threshold as BEARISH', () => {
      const rmi = new RMI({interval: 3, momentum: 2, signalThresholds: {oversold: 0}});

      for (const price of [9, 8, 7, 6, 5] as const) {
        rmi.add(price);
      }

      expect(rmi.getResultOrThrow()).toBe(0);
      expect(rmi.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});

testIndicatorContract({
  create: () => new RMI({interval: 3, momentum: 2}),
  divergentInput: 1_000,
  inputs: [10, 12, 11, 13, 14, 12, 15, 13],
});
