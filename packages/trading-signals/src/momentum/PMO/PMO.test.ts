import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {PMO} from './PMO.js';
import {TradingSignal} from '../../base/index.js';

describe('PMO', () => {
  describe('update', () => {
    it('double-smooths the one-bar percentage change into the PMO line and pairs it with a signal EMA', () => {
      /*
       * Hand-derived reference values for Carl Swenlin's DecisionPoint formula
       * PMO = smooth2(10 * smooth1(100 * (price / previousPrice - 1))) with signal = EMA(PMO),
       * where both custom smoothing stages weight the newest bar with 2/interval:
       * https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/decisionpoint-price-momentum-oscillator-pmo
       *
       * Committed baselines of other libraries (e.g. Skender.Stock.Indicators v3.0.0) seed all
       * three stages with an SMA while this library seeds with the first input, so their early
       * readings cannot be reproduced here (fed with their 502-quote dataset, both agree to 6
       * decimals only after ~300 bars of transient decay) and the expectations are derived by
       * hand instead. Smoothing weights: stage one (4) w=1/2, stage two (3) w=2/3, signal
       * EMA(3) w=1/2. Stage two starts once stage one is warmed up, the signal EMA once stage
       * two is warmed up.
       *
       * price  | roc  | smooth1 | 10*smooth1 | PMO                | signal
       * 100    |  -   |    -    |     -      | -                  | -
       * 150    |  50  |   50    |     -      | -                  | -
       * 75     | -50  |    0    |     -      | -                  | -
       * 150    | 100  |   50    |     -      | -                  | -
       * 225    |  50  |   50    |    500     | 500 (warming)      | -
       * 112.5  | -50  |    0    |     0      | 500/3 (warming)    | -
       * 225    | 100  |   50    |    500     | 3500/9 = 388.89    | 3500/9 = 388.89
       * 337.5  |  50  |   50    |    500     | 12500/27 = 462.96  | 11500/27 = 425.93
       * 168.75 | -50  |    0    |     0      | 12500/81 = 154.32  | 23500/81 = 290.12
       */
      const prices = [100, 150, 75, 150, 225, 112.5, 225, 337.5, 168.75] as const;
      const expectations = [
        {pmo: '388.8889', signal: '388.8889'},
        {pmo: '462.9630', signal: '425.9259'},
        {pmo: '154.3210', signal: '290.1235'},
      ] as const;
      const pmo = new PMO({signalInterval: 3, smoothing1: 4, smoothing2: 3});
      const offset = pmo.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = pmo.add(price);

        if (result !== null) {
          const expected = expectations[i - offset];

          expect(result.pmo.toFixed(4)).toBe(expected.pmo);
          expect(result.signal.toFixed(4)).toBe(expected.signal);
        }
      });

      expect(pmo.isStable).toBe(true);
    });

    it('scales the smoothed percentage change by ten, so a market doubling every bar reads 1000', () => {
      const prices = [1, 2, 4, 8, 16, 32, 64] as const;
      const pmo = new PMO({signalInterval: 3, smoothing1: 4, smoothing2: 3});

      for (const price of prices) {
        pmo.add(price);
      }

      expect(pmo.getResultOrThrow().pmo).toBe(1000);
      expect(pmo.getResultOrThrow().signal).toBe(1000);
    });
  });

  describe('constructor', () => {
    it('rejects a smoothing interval that cannot form a finite weight', () => {
      expect(() => new PMO({smoothing1: 0})).toThrowError(
        'The interval has to be a positive number, but "0" was given.'
      );
      expect(() => new PMO({smoothing2: Number.NaN})).toThrowError(
        'The interval has to be a positive number, but "NaN" was given.'
      );
    });

    it("uses Carl Swenlin's canonical periods of 35, 20 and 10 by default", () => {
      const pmo = new PMO();

      expect(pmo.smoothing1).toBe(35);
      expect(pmo.smoothing2).toBe(20);
      expect(pmo.signalInterval).toBe(10);
      expect(pmo.isStable).toBe(false);

      for (let i = 1; i < pmo.getRequiredInputs(); i++) {
        expect(pmo.add(2 ** (i - 1))).toBeNull();
      }

      const result = pmo.add(2 ** 54);

      expect(result?.pmo.toFixed(6)).toBe('1000.000000');
      expect(result?.signal.toFixed(6)).toBe('1000.000000');
      expect(pmo.isStable).toBe(true);
    });
  });

  describe('getRequiredInputs', () => {
    it('needs both custom smoothing stages to warm up', () => {
      expect(new PMO().getRequiredInputs()).toBe(55);
      expect(new PMO({signalInterval: 3, smoothing1: 4, smoothing2: 3}).getRequiredInputs()).toBe(7);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const prices = [100, 150, 75, 150, 225, 112.5, 225, 337.5] as const;
      const pmo = new PMO({signalInterval: 3, smoothing1: 4, smoothing2: 3});

      for (const price of prices) {
        pmo.add(price);
      }

      // Losing half vs. doubling: 12500/81 & 23500/81 vs. 53000/81 & 43750/81
      const originalValue = 168.75;
      const replacedValue = 675;

      const originalResult = pmo.add(originalValue);

      expect(originalResult?.pmo.toFixed(4)).toBe('154.3210');
      expect(originalResult?.signal.toFixed(4)).toBe('290.1235');

      const replacedResult = pmo.replace(replacedValue);

      expect(replacedResult?.pmo.toFixed(4)).toBe('654.3210');
      expect(replacedResult?.signal.toFixed(4)).toBe('540.1235');

      const restoredResult = pmo.replace(originalValue);

      expect(restoredResult?.pmo).toBe(originalResult?.pmo);
      expect(restoredResult?.signal).toBe(originalResult?.signal);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN while the indicator is warming up', () => {
      const pmo = new PMO({signalInterval: 3, smoothing1: 4, smoothing2: 3});

      expect(pmo.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });

      pmo.add(100);
      pmo.add(150);

      expect(pmo.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when the PMO rises above its signal line', () => {
      const prices = [100, 150, 75, 150, 225, 112.5, 225, 337.5] as const;
      const pmo = new PMO({signalInterval: 3, smoothing1: 4, smoothing2: 3});

      for (const price of prices) {
        pmo.add(price);
      }

      expect(pmo.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the PMO falls below its signal line', () => {
      const prices = [100, 150, 75, 150, 225, 112.5, 225, 337.5, 168.75] as const;
      const pmo = new PMO({signalInterval: 3, smoothing1: 4, smoothing2: 3});

      for (const price of prices) {
        pmo.add(price);
      }

      expect(pmo.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when a flat market keeps both lines equal at zero', () => {
      const pmo = new PMO({signalInterval: 3, smoothing1: 4, smoothing2: 3});

      for (let i = 0; i < 8; i++) {
        pmo.add(100);
      }

      expect(pmo.getResultOrThrow().pmo).toBe(0);

      expect(pmo.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.SIDEWAYS,
      });
    });

    it('flags the change when momentum flips from BULLISH to BEARISH', () => {
      const prices = [100, 150, 75, 150, 225, 112.5, 225, 337.5] as const;
      const pmo = new PMO({signalInterval: 3, smoothing1: 4, smoothing2: 3});

      for (const price of prices) {
        pmo.add(price);
      }

      expect(pmo.getSignal().state).toBe(TradingSignal.BULLISH);

      pmo.add(168.75);

      expect(pmo.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });

      pmo.add(84.375);

      expect(pmo.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BEARISH,
      });
    });
  });
});

testIndicatorContract({
  create: () => new PMO({signalInterval: 2, smoothing1: 3, smoothing2: 2}),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84],
});
