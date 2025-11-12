import {WilliamsR} from './WilliamsR.js';
import {StochasticOscillator} from '../STOCH/StochasticOscillator.js';
import {NotEnoughDataError} from '../../error/index.js';
import {MomentumSignal} from '../../types/index.js';
import candles from '../../fixtures/STOCH/candles.json' with {type: 'json'};

describe('WilliamsR', () => {
  describe('update', () => {
    it('calculates the Williams %R indicator', () => {
      const expectations = [
        '-7.48',
        '-23.01',
        '-40.93',
        '-15.50',
        '-11.42',
        '-23.70',
        '-10.28',
        '-0.93',
        '-3.05',
        '-5.79',
        '-17.88',
      ] as const;

      const willR = new WilliamsR(5);
      const offset = willR.getRequiredInputs() - 1;

      candles.forEach((candle, i) => {
        const result = willR.add(candle);

        if (willR.isStable && result !== null) {
          const expected = expectations[i - offset];
          expect(result.toFixed(2)).toBe(expected);
        }
      });

      expect(willR.isStable).toBe(true);
      expect(willR.getRequiredInputs()).toBe(5);
      expect(willR.getResultOrThrow().toFixed(2)).toBe('-17.88');
    });

    it('returns null until enough values are provided', () => {
      const willR = new WilliamsR(5);

      for (let i = 0; i < 4; i++) {
        const result = willR.add({close: i, high: i + 1, low: i - 1});
        expect(result).toBeNull();
      }

      expect(willR.isStable).toBe(false);
    });

    it('prevents division by zero when highest high and lowest low have the same value', () => {
      const willR = new WilliamsR(5);

      for (let i = 0; i < 4; i++) {
        willR.add({close: 100, high: 100, low: 100});
      }

      const result = willR.add({close: 100, high: 100, low: 100});
      expect(result).toBe(-100);
      expect(willR.getResultOrThrow()).toBe(-100);
    });

    it('verifies Williams %R is equivalent to inverted Stochastic %K', () => {
      // Williams %R = -100 * (Highest High - Close) / (Highest High - Lowest Low)
      // Stochastic %K = 100 * (Close - Lowest Low) / (Highest High - Lowest Low)
      // Therefore: Williams %R = Stochastic %K - 100
      const willR = new WilliamsR(5);
      const stoch = new StochasticOscillator(5, 1, 1);

      candles.forEach(candle => {
        const willRResult = willR.add(candle);
        const stochResult = stoch.add(candle);

        if (willRResult !== null && stochResult !== null) {
          const {stochK} = stochResult;
          expect(willRResult.toFixed(2)).toBe((stochK - 100).toFixed(2));
        }
      });

      expect(willR.isStable).toBe(true);
      expect(stoch.isStable).toBe(true);

      const willRFinal = willR.getResultOrThrow();
      const stochKFinal = stoch.getResultOrThrow().stochK;
      expect(willRFinal.toFixed(2)).toBe((stochKFinal - 100).toFixed(2));
    });

    it('handles the replace parameter correctly', () => {
      const willR = new WilliamsR(3);
      const latestValue = {close: 12, high: 13, low: 11};
      const someOtherValue = {close: 11.5, high: 12.5, low: 10.5};

      willR.add({close: 10, high: 11, low: 9});
      willR.add({close: 11, high: 12, low: 10});
      const result = willR.add(latestValue);

      const replacedResult = willR.replace(someOtherValue);
      expect(result).not.toBe(replacedResult);
      expect(willR.candles.length).toBe(3);

      const revertedResult = willR.replace(latestValue);
      expect(result).toBe(revertedResult);
      expect(willR.candles.length).toBe(3);
    });
  });

  describe('getResultOrThrow', () => {
    it('throws an error when there is not enough input data', () => {
      const willR = new WilliamsR(14);

      for (let i = 0; i < 13; i++) {
        willR.add({close: i, high: i + 1, low: i - 1});
      }

      try {
        willR.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const willR = new WilliamsR(14);
      const calculateSignalState = willR['calculateSignalState'].bind(willR);
      const signal = calculateSignalState(null);
      expect(signal).toBe(MomentumSignal.UNKNOWN);
    });

    it('returns OVERBOUGHT when Williams %R >= -20', () => {
      const willR = new WilliamsR(14);
      const calculateSignalState = willR['calculateSignalState'].bind(willR);
      const signal = calculateSignalState(-20);
      expect(signal).toBe(MomentumSignal.OVERBOUGHT);
    });

    it('returns OVERSOLD when Williams %R <= -80', () => {
      const willR = new WilliamsR(14);
      const calculateSignalState = willR['calculateSignalState'].bind(willR);
      const signal = calculateSignalState(-80);
      expect(signal).toBe(MomentumSignal.OVERSOLD);
    });

    it('returns UNKNOWN when Williams %R is between -80 and -20', () => {
      const willR = new WilliamsR(14);
      const calculateSignalState = willR['calculateSignalState'].bind(willR);
      const signal = calculateSignalState(-50);
      expect(signal).toBe(MomentumSignal.NEUTRAL);
    });
  });
});
