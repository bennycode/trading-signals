import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {UlcerIndex} from './UlcerIndex.js';

describe('UlcerIndex', () => {
  describe('constructor', () => {
    it("uses Peter Martin's 14-period window by default", () => {
      const ui = new UlcerIndex();

      expect(ui.interval).toBe(14);
      expect(ui.getRequiredInputs()).toBe(14);
    });
  });

  describe('getResultOrThrow', () => {
    it('reads a market pinned at zero as having no drawdown', () => {
      const ui = new UlcerIndex(3);

      for (let i = 0; i < 3; i++) {
        ui.add(0);
      }

      expect(ui.getResultOrThrow()).toBe(0);
    });

    it('matches the Skender.Stock.Indicators reference results', () => {
      /*
       * The expectations are the Skender.Stock.Indicators v3.0.0 baseline for the Ulcer Index (14)
       * over the first 30 closes of its default test quotes. The Ulcer Index only ever looks back
       * one interval, so a leading slice of the series yields the same results as a full run.
       *
       * Quotes: https://raw.githubusercontent.com/facioquo/stock-indicators-dotnet/3.0.0/tests/indicators/_testdata/quotes/default.csv
       * Results: https://raw.githubusercontent.com/facioquo/stock-indicators-dotnet/3.0.0/tests/indicators/_testdata/results/ulcer.standard.json
       */
      const closes = [
        212.8, 214.06, 213.89, 214.66, 213.95, 213.95, 214.55, 214.02, 214.51, 213.75, 214.22, 213.43, 214.21, 213.66,
        215.03, 216.89, 216.66, 216.32, 214.98, 214.96, 215.05, 215.19, 216.67, 216.28, 216.29, 216.58, 217.86, 218.72,
        219.91, 220.79,
      ] as const;
      const expectations = [
        '0.2844201',
        '0.2844201',
        '0.2836270',
        '0.2850395',
        '0.2351403',
        '0.3326929',
        '0.4089552',
        '0.4583534',
        '0.5039547',
        '0.4778201',
        '0.4836963',
        '0.4791037',
        '0.4806241',
        '0.4757002',
        '0.4757002',
        '0.4757002',
        '0.4069892',
      ] as const;
      const ui = new UlcerIndex(14);
      const offset = ui.getRequiredInputs() - 1;
      let verifiedBars = 0;

      closes.forEach((close, i) => {
        const result = ui.add(close);

        if (result !== null) {
          verifiedBars++;
          expect(result.toFixed(7)).toBe(expectations[i - offset]);
        }
      });

      expect(verifiedBars).toBe(expectations.length);
    });

    it('root-mean-squares the percentage drawdowns from the highest close in the window', () => {
      /*
       * Hand-derived reference for Peter Martin's formula with a 3-bar window,
       * where each bar's drawdown is measured against the highest close seen so far in the window:
       *
       * Window [100, 90, 80] — a straight 20% slide:
       * close | highest close | drawdown %               | drawdown²
       *   100 |           100 | 0                        | 0
       *    90 |           100 | 100 × (90−100)/100 = −10 | 100
       *    80 |           100 | 100 × (80−100)/100 = −20 | 400
       * UI = sqrt((0 + 100 + 400) / 3) = sqrt(500/3) ≈ 12.9099
       *
       * Window [90, 80, 120] — the slide is followed by a recovery to a new high. The recovery
       * bar itself carries no drawdown, but the underwater bar before it still weighs in:
       * close | highest close | drawdown %                  | drawdown²
       *    90 |            90 | 0                           | 0
       *    80 |            90 | 100 × (80−90)/90 ≈ −11.1111 | 10000/81
       *   120 |           120 | 0                           | 0
       * UI = sqrt((10000/81) / 3) = sqrt(10000/243) ≈ 6.4150
       */
      const ui = new UlcerIndex(3);
      const closes = [100, 90, 80] as const;

      for (const close of closes) {
        ui.add(close);
      }

      expect(ui.getResultOrThrow()).toBe(12.909944487358056);

      ui.add(120);

      expect(ui.getResultOrThrow()).toBe(6.415002990995841);
    });

    it('reports exactly 0 when every close is a new high', () => {
      const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
      const ui = new UlcerIndex(5);

      for (const close of closes) {
        const result = ui.add(close);

        if (result !== null) {
          expect(result).toBe(0);
        }
      }

      expect(ui.isStable).toBe(true);
    });

    it('reports exactly 0 for a flat market', () => {
      const ui = new UlcerIndex(3);

      for (let i = 0; i < 4; i++) {
        ui.add(100);
      }

      expect(ui.getResultOrThrow()).toBe(0);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const ui = new UlcerIndex(3);
      const closes = [100, 90, 80] as const;

      for (const close of closes) {
        ui.add(close);
      }

      expect(ui.getResultOrThrow()).toBe(12.909944487358056);

      // Window [90, 80, 120]: recovery to a new high — see the hand-derived table above
      const originalResult = ui.add(120);

      expect(originalResult).toBe(6.415002990995841);

      // Window [90, 80, 70]: drawdowns of −100/9% and −200/9% → UI = sqrt((50000/81) / 3)
      const replacedResult = ui.replace(70);

      expect(replacedResult).toBe(14.344382763731174);

      const restoredResult = ui.replace(120);

      expect(restoredResult).toBe(originalResult);
    });
  });
});

testIndicatorContract({
  create: () => new UlcerIndex(5),
  divergentInput: 1_000,
  inputs: [212.8, 214.06, 213.89, 214.66, 213.95, 213.95],
});
