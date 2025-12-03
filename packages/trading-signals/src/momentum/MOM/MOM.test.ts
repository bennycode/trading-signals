import {MOM} from './MOM.js';
import {NotEnoughDataError} from '../../error/index.js';
import {TradingSignal} from '../../types/Indicator.js';

describe('MOM', () => {
  describe('update', () => {
    it('can replace recently added values', () => {
      const momentum = new MOM(5);

      momentum.add(81.59);
      momentum.add(81.06);
      momentum.add(82.87);
      momentum.add(83.0);
      momentum.add(83.61);
      momentum.add(90);
      momentum.replace(83.15);

      expect(momentum.isStable).toBe(true);
      expect(momentum.getResultOrThrow().toFixed(2)).toBe('1.56');
    });
  });

  describe('getResultOrThrow', () => {
    it('returns the price 5 intervals ago', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L286-L288
      const inputs = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const outputs = [1.56, 1.78, 1.12, 1.55, 0.75, 2.38, 3.7, 2.9, 3.22, 2.93] as const;
      const interval = 5;
      const momentum = new MOM(interval);

      for (const [index, input] of inputs.entries()) {
        momentum.add(input);
        if (momentum.isStable) {
          const expected = outputs[index - interval];
          expect(momentum.getResultOrThrow().toFixed(2)).toBe(expected.toFixed(2));
        }
      }

      expect(momentum.isStable).toBe(true);
      expect(momentum.getRequiredInputs()).toBe(6);
    });

    it('throws an error when there is not enough input data', () => {
      const momentum = new MOM(5);

      try {
        momentum.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const momentum = new MOM(5);
      const signal = momentum.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when current result is greater than previous result at interval boundary', () => {
      const momentum = new MOM(5);
      // Need 15 values total to get 2 signal evaluation points
      // First 6 values to get first result, then 5 more for period 10 (first eval), then 5 more for period 15 (second eval)
      const values = [10, 11, 12, 13, 14, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60] as const;

      for (const value of values) {
        momentum.add(value);
      }

      const signal = momentum.getSignal();
      expect(signal.state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when current result is less than previous result at interval boundary', () => {
      const momentum = new MOM(5);
      // Values that create decreasing momentum
      const values = [100, 95, 90, 85, 80, 75, 65, 55, 45, 35, 25, 15, 5, -5, -15] as const;

      for (const value of values) {
        momentum.add(value);
      }

      const signal = momentum.getSignal();
      expect(signal.state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when not at interval boundary', () => {
      const momentum = new MOM(5);
      // Need at least 11 values to get past first evaluation point (at period 5) and be between evaluations
      const values = [10, 11, 12, 13, 14, 15, 20, 25, 30, 35, 40] as const;

      for (const value of values) {
        momentum.add(value);
      }

      // At period 11 (6th result, periodCounter=6), we're between evaluations (not at period 5, 10, 15, etc.)
      // First evaluation was at period 5 and returned SIDEWAYS, so this should also be SIDEWAYS
      const signal = momentum.getSignal();
      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
    });

    it('maintains last signal between evaluation periods', () => {
      const momentum = new MOM(5);

      // Add values to create a BULLISH signal at period 15 (2nd evaluation point)
      const values = [10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 55, 65, 75, 85, 90, 95, 100, 105] as const;

      for (const [index, value] of values.entries()) {
        momentum.add(value);

        // At period 15 (index 14, periodCounter=10), we get BULLISH signal (2nd evaluation)
        if (index === 14) {
          expect(momentum.getSignal().state).toBe(TradingSignal.BULLISH);
        }

        // Between period 16-19 (index 15-18), signal should remain BULLISH
        if (index >= 15 && index <= 18) {
          expect(momentum.getSignal().state).toBe(TradingSignal.BULLISH);
        }
      }
    });

    it('compares momentum at 5-period intervals', () => {
      const momentum = new MOM(5);

      // Add 15 values to get 2 signal evaluation points (at period 5 and period 10)
      // Using simple values where momentum clearly increases or decreases
      const values = [10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 55, 65, 75, 85] as const;

      for (const value of values) {
        momentum.add(value);
      }

      // After 15 values (10 results), we're at the 2nd evaluation point (period counter = 10)
      // Result at period 5: 18 - 10 = 8
      // Result at period 10: 45 - 20 = 25
      // Since 25 > 8, signal should be BULLISH
      expect(momentum.getSignal().state).toBe(TradingSignal.BULLISH);
    });
  });
});
