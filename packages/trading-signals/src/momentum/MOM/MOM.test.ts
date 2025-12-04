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

  describe('getRequiredInputs', () => {
    it('returns a result after enough inputs have been added', () => {
      const interval = 5;
      const momentum = new MOM(interval);

      expect(momentum.getRequiredInputs()).toBe(6);
      expect(momentum.isStable).toBe(false);

      for (let i = 0; i < momentum.getRequiredInputs(); i++) {
        momentum.add((i + 1) * 10);
      }

      expect(momentum.isStable).toBe(true);
      expect(momentum.getResult()).toBe(50);
    });
  });

  describe('getSignal', () => {
    it('returns BULLISH signal when momentum increases', () => {
      const prices = [10, 20, 30, 40, 50, 70, 100] as const;
      const mom = new MOM(5);

      for (let i = 0; i < 7; i++) {
        mom.add(prices[i]);
      }

      const signal = mom.getSignal();

      expect(signal.state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH signal when momentum decreases', () => {
      const prices = [10, 20, 30, 40, 50, 45, 35] as const;
      const mom = new MOM(5);

      for (let i = 0; i < 7; i++) {
        mom.add(prices[i]);
      }

      const signal = mom.getSignal();

      expect(signal.state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS signal when momentum remains constant', () => {
      const prices = [10, 20, 30, 40, 50, 55, 65] as const;
      const mom = new MOM(5);

      for (let i = 0; i < 7; i++) {
        mom.add(prices[i]);
      }

      const signal = mom.getSignal();

      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
    });
  });
});
