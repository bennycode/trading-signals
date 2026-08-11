import {TradingSignal} from '../../base/index.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {PSL} from './PSL.js';

describe('PSL', () => {
  /*
   * There is no Tulip Indicators entry for the Psychological Line, so the expectations are derived by hand
   * from the published formula — 100 × (number of bars closing above their previous close) / interval — with
   * rising-bar counts chosen so every reading divides exactly.
   *
   * Formula sources:
   * @see https://github.com/xgboosted/pandas-ta-classic/blob/main/pandas_ta_classic/momentum/psl.py
   * @see https://www.moomoo.com/us/support/topic3_814
   *
   * Worksheet (interval 4): the window spans the last 5 closes, i.e. 4 close-to-close comparisons.
   *
   * | Bar | Close | Direction | Rising in window | PSL          |
   * | --- | ----- | --------- | ---------------- | ------------ |
   * | 1   | 10    | —         | —                | —            |
   * | 2   | 11    | up        | —                | —            |
   * | 3   | 12    | up        | —                | —            |
   * | 4   | 11    | down      | —                | —            |
   * | 5   | 13    | up        | 3 of 4           | 300 / 4 = 75 |
   * | 6   | 12    | down      | 2 of 4           | 200 / 4 = 50 |
   * | 7   | 11    | down      | 1 of 4           | 100 / 4 = 25 |
   * | 8   | 10    | down      | 1 of 4           | 100 / 4 = 25 |
   * | 9   | 9     | down      | 0 of 4           | 0 / 4 = 0    |
   */
  const closes = [10, 11, 12, 11, 13, 12, 11, 10, 9] as const;

  describe('getResultOrThrow', () => {
    it('measures the share of bars that closed above their previous close', () => {
      const expectations = [75, 50, 25, 25, 0] as const;
      const psl = new PSL({interval: 4});
      const offset = psl.getRequiredInputs() - 1;

      closes.forEach((close, i) => {
        const result = psl.add(close);

        if (result !== null) {
          expect(result).toBe(expectations[i - offset]);
        }
      });

      expect(psl.isStable).toBe(true);
    });

    it('spans twelve close-to-close comparisons by default', () => {
      // 9 rising bars followed by 3 falling bars: 900 / 12 = 75
      const risingThenFalling = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 108, 107, 106] as const;
      const psl = new PSL();

      for (const close of risingThenFalling) {
        psl.add(close);
      }

      expect(psl.getResultOrThrow()).toBe(75);
    });

    it('counts an unchanged close as a falling period', () => {
      // Bars 2 and 4 close flat, so only bars 3 and 5 rise: 200 / 4 = 50
      const tiedCloses = [10, 10, 11, 11, 12] as const;
      const psl = new PSL({interval: 4});

      for (const close of tiedCloses) {
        psl.add(close);
      }

      expect(psl.getResultOrThrow()).toBe(50);
    });

    it('reads zero when every close in the window stays unchanged', () => {
      const psl = new PSL({interval: 4});

      for (let i = 0; i < 5; i++) {
        psl.add(100);
      }

      expect(psl.getResultOrThrow()).toBe(0);
    });
  });

  describe('getRequiredInputs', () => {
    it('needs 13 closes by default to form twelve comparisons', () => {
      const psl = new PSL();

      expect(psl.getRequiredInputs()).toBe(13);
    });

    it('needs one close more than the configured interval', () => {
      const psl = new PSL({interval: 4});

      expect(psl.getRequiredInputs()).toBe(5);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const psl = new PSL({interval: 4});

      for (const close of closes.slice(0, 5)) {
        psl.add(close);
      }

      /*
       * The window closes become 11, 12, 11, 13 plus the newest bar: a close of 9 leaves 2 rising bars
       * (50), a close of 15 leaves 3 rising bars (75).
       */
      const originalValue = 9;
      const replacedValue = 15;

      const originalResult = psl.add(originalValue);

      expect(originalResult).toBe(50);

      const replacedResult = psl.replace(replacedValue);

      expect(replacedResult).toBe(75);

      const restoredResult = psl.replace(originalValue);

      expect(restoredResult).toBe(50);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const psl = new PSL({interval: 4});
      const signal = psl.getSignal();

      expect(signal.state).toBe(TradingSignal.UNKNOWN);
      expect(signal.hasChanged).toBe(false);
    });

    it('signals bullish pressure when every bar in the window closed higher', () => {
      const psl = new PSL({interval: 4});

      for (const close of [1, 2, 3, 4, 5] as const) {
        psl.add(close);
      }

      expect(psl.getResultOrThrow()).toBe(100);

      const signal = psl.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('signals bearish pressure when every bar in the window closed lower', () => {
      const psl = new PSL({interval: 4});

      for (const close of [5, 4, 3, 2, 1] as const) {
        psl.add(close);
      }

      expect(psl.getResultOrThrow()).toBe(0);

      const signal = psl.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('returns SIDEWAYS while the reading stays between the bands', () => {
      // Both stable bars read 50, so the signal settles instead of flagging a change
      const balancedCloses = [10, 11, 12, 11, 10, 11] as const;
      const psl = new PSL({interval: 4});

      for (const close of balancedCloses) {
        psl.add(close);
      }

      expect(psl.getResultOrThrow()).toBe(50);

      const signal = psl.getSignal();

      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
      expect(signal.hasChanged).toBe(false);
    });

    it('turns bullish exactly at the overbought threshold', () => {
      const defaults = new PSL({interval: 4});
      const custom = new PSL({interval: 4, signalThresholds: {overbought: 80, oversold: 20}});
      // 3 rising bars out of 4 comparisons: 300 / 4 = 75, exactly on the conventional band
      const risingCloses = [10, 11, 12, 13, 12] as const;

      for (const psl of [defaults, custom]) {
        for (const close of risingCloses) {
          psl.add(close);
        }

        expect(psl.getResultOrThrow()).toBe(75);
      }

      expect(defaults.getSignal().state).toBe(TradingSignal.BULLISH);
      expect(custom.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('turns bearish exactly at the oversold threshold', () => {
      const defaults = new PSL({interval: 4});
      const custom = new PSL({interval: 4, signalThresholds: {overbought: 80, oversold: 20}});
      // 1 rising bar out of 4 comparisons: 100 / 4 = 25, exactly on the conventional band
      const fallingCloses = [10, 11, 10, 9, 8] as const;

      for (const psl of [defaults, custom]) {
        for (const close of fallingCloses) {
          psl.add(close);
        }

        expect(psl.getResultOrThrow()).toBe(25);
      }

      expect(defaults.getSignal().state).toBe(TradingSignal.BEARISH);
      expect(custom.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });
  });
});

testIndicatorContract({
  create: () => new PSL({interval: 4}),
  divergentInput: 1_000,
  inputs: [10, 11, 12, 11, 13, 12],
});
