import {TradingSignal} from '../../base/Indicator.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {CFO} from './CFO.js';

describe('CFO', () => {
  describe('constructor', () => {
    it('rejects an interval below 2', () => {
      expect(() => new CFO(1)).toThrowError('The interval has to be at least 2, but "1" was given.');
      expect(() => new CFO(Number.NaN)).toThrowError('The interval has to be at least 2, but "NaN" was given.');
    });
  });

  describe('update', () => {
    it('replaces the most recently added value', () => {
      const cfo = new CFO(5);
      const closes = [81.59, 81.06, 82.87, 83.0, 83.61] as const;

      for (const close of closes) {
        cfo.add(close);
      }

      const originalResult = cfo.add(83.15);

      expect(originalResult?.toFixed(3)).toBe('-1.287');

      const replacedResult = cfo.replace(90);

      expect(replacedResult?.toFixed(3)).toBe('6.422');

      const restoredResult = cfo.replace(83.15);

      expect(restoredResult?.toFixed(3)).toBe('-1.287');
    });

    it('reports the neutral zero line when the close is zero', () => {
      const closes = [10, 11, 12, 13, 14, 0] as const;
      const cfo = new CFO(5);

      for (const close of closes) {
        cfo.add(close);
      }

      expect(cfo.getResultOrThrow()).toBe(0);
      expect(cfo.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('stays on the zero line while price follows a perfectly linear trend', () => {
      const trends = [
        {start: 10, step: 1},
        {start: 100, step: -2.5},
        {start: 42, step: 0},
        {start: 7, step: 3},
      ] as const;

      for (const {start, step} of trends) {
        const cfo = new CFO(5);

        for (let i = 0; i < 10; i++) {
          const result = cfo.add(start + i * step);

          if (result !== null) {
            expect(result).toBe(0);
          }
        }

        expect(cfo.getResultOrThrow()).toBe(0);
        expect(cfo.getSignal().state).toBe(TradingSignal.SIDEWAYS);
      }
    });
  });

  describe('getResultOrThrow', () => {
    it('matches values derived from Tulip Indicators forecasts', {tags: ['tulipindicators']}, () => {
      /*
       * The internal forecast is Tulip's "tsf" (time series forecast, period 5), verified with:
       * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L430-L432
       *
       * Every close pairs with the forecast fitted over the 5 closes preceding it, so each
       * expectation derives from a Tulip tsf value as CFO = 100 × (close − tsf) / close:
       *
       * 100 × (83.15 − 84.220) / 83.15 = -1.287
       * 100 × (82.84 − 84.214) / 82.84 = -1.659
       * 100 × (83.99 − 83.121) / 83.99 =  1.035
       * 100 × (84.55 − 83.681) / 84.55 =  1.028
       * 100 × (84.36 − 84.444) / 84.36 = -0.100
       * 100 × (85.53 − 85.017) / 85.53 =  0.600
       * 100 × (86.54 − 85.979) / 86.54 =  0.648
       * 100 × (86.89 − 86.818) / 86.89 =  0.083
       * 100 × (87.77 − 87.632) / 87.77 =  0.157
       * 100 × (87.29 − 88.672) / 87.29 = -1.583
       *
       * Tulip ships the identical pairing as its Forecast Oscillator ("fosc"), so the derived
       * values equal the reference outputs at:
       * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L199-L201
       */
      const inputs = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expectations = [
        '-1.287',
        '-1.659',
        '1.035',
        '1.028',
        '-0.100',
        '0.600',
        '0.648',
        '0.083',
        '0.157',
        '-1.583',
      ] as const;
      const cfo = new CFO(5);
      const offset = cfo.getRequiredInputs() - 1;

      inputs.forEach((input, i) => {
        const result = cfo.add(input);

        if (result !== null) {
          expect(result.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(cfo.isStable).toBe(true);
    });
  });

  describe('getRequiredInputs', () => {
    it('needs one close beyond the regression window', () => {
      expect(new CFO(5).getRequiredInputs()).toBe(6);
    });

    it('defaults to an interval of 14', () => {
      expect(new CFO().getRequiredInputs()).toBe(15);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const closes = [10, 11, 12] as const;
      const cfo = new CFO(5);

      for (const close of closes) {
        cfo.add(close);
      }

      const signal = cfo.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });

    it('returns BULLISH when the close runs ahead of its projection', () => {
      const closes = [10, 11, 12, 13, 14, 20] as const;
      const cfo = new CFO(5);

      for (const close of closes) {
        cfo.add(close);
      }

      const signal = cfo.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns BEARISH when the close falls short of its projection', () => {
      const closes = [10, 11, 12, 13, 14, 5] as const;
      const cfo = new CFO(5);

      for (const close of closes) {
        cfo.add(close);
      }

      const signal = cfo.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the close matches its projection', () => {
      const closes = [10, 11, 12, 13, 14, 15] as const;
      const cfo = new CFO(5);

      for (const close of closes) {
        cfo.add(close);
      }

      expect(cfo.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags the zero-line cross and keeps the state while the pressure persists', () => {
      const closes = [10, 11, 12, 13, 14, 20] as const;
      const cfo = new CFO(5);

      for (const close of closes) {
        cfo.add(close);
      }

      expect(cfo.getSignal().state).toBe(TradingSignal.BULLISH);

      cfo.add(5);

      const crossed = cfo.getSignal();

      expect(crossed.state).toBe(TradingSignal.BEARISH);
      expect(crossed.hasChanged).toBe(true);

      cfo.add(5);

      const persisted = cfo.getSignal();

      expect(persisted.state).toBe(TradingSignal.BEARISH);
      expect(persisted.hasChanged).toBe(false);
    });
  });
});

testIndicatorContract({
  create: () => new CFO(5),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84],
});
