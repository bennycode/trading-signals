import {FasterSMA15, NotEnoughDataError, SMA15} from '../index.js';
import {describe} from 'vitest';

describe('SMA15', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary', () => {
      const sma15 = new SMA15();
      const fasterSma15 = new FasterSMA15();

      for (let i = 1; i <= 14; i++) {
        sma15.add(i);
        fasterSma15.add(i);
        expect(sma15.prices.length).toBe(i);
        expect(fasterSma15.prices.length).toBe(i);
      }

      sma15.add(15);
      fasterSma15.add(15);
      expect(sma15.prices.length).toBe(15);
      expect(fasterSma15.prices.length).toBe(15);

      sma15.add(16);
      fasterSma15.add(16);
      expect(sma15.prices.length).toBe(15);
      expect(fasterSma15.prices.length).toBe(15);
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const sma15 = new SMA15();
      const fasterSma15 = new FasterSMA15();

      // Add 15 values to fill the window
      for (let i = 1; i <= 15; i++) {
        sma15.add(i);
        fasterSma15.add(i);
      }

      // Calculate expected result
      const weights = [-3, -6, -5, 3, 21, 46, 67, 74, 67, 46, 21, 3, -5, -6, -3];
      const sum = weights.reduce((acc, weight, idx) => acc + weight * (idx + 1), 0);
      const expectedResult = (sum / 320).toFixed(2);

      // Check initial result
      expect(sma15.getResultOrThrow().toFixed(2)).toBe(expectedResult);
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe(expectedResult);

      // Replace last value with a different one
      const newValue = 100;
      sma15.replace(newValue);
      fasterSma15.replace(newValue);

      // Calculate new expected result after replacement
      const newSum = weights.reduce((acc, weight, idx) => {
        const value = idx === 14 ? newValue : idx + 1;
        return acc + weight * value;
      }, 0);
      const newExpectedResult = (newSum / 320).toFixed(2);

      // Check result after replacement
      expect(sma15.getResultOrThrow().toFixed(2)).toBe(newExpectedResult);
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe(newExpectedResult);
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const prices = Array.from({length: 15}, (_, i) => i + 1);
      const sma15 = new SMA15();
      const fasterSma15 = new FasterSMA15();

      sma15.updates(prices, false);
      fasterSma15.updates(prices, false);

      const weights = [-3, -6, -5, 3, 21, 46, 67, 74, 67, 46, 21, 3, -5, -6, -3];
      const sum = weights.reduce((acc, weight, idx) => acc + weight * (idx + 1), 0);
      const expectedResult = (sum / 320).toFixed(2);

      expect(sma15.getResultOrThrow().toFixed(2)).toBe(expectedResult);
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe(expectedResult);
    });
  });

  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const sma15 = new SMA15();
      const fasterSma15 = new FasterSMA15();

      for (let i = 1; i <= 14; i++) {
        sma15.add(i);
        fasterSma15.add(i);
        expect(sma15.isStable).toBe(false);
        expect(fasterSma15.isStable).toBe(false);
      }

      sma15.add(15);
      fasterSma15.add(15);
      expect(sma15.isStable).toBe(true);
      expect(fasterSma15.isStable).toBe(true);
    });
  });

  describe('getResultOrThrow', () => {
    it('throws an error when there is not enough input data', () => {
      const sma15 = new SMA15();
      const fasterSma15 = new FasterSMA15();

      try {
        sma15.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }

      try {
        fasterSma15.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it("calculates Spencer's 15-Point Moving Average correctly", () => {
      const sma15 = new SMA15();
      const fasterSma15 = new FasterSMA15();

      // Test with constant prices to ensure our weights work correctly
      const constantPrice = 10;
      for (let i = 0; i < 15; i++) {
        sma15.add(constantPrice);
        fasterSma15.add(constantPrice);
      }

      // With constant price, the result should equal the price regardless of weights
      // (all weights sum to 320, divided by 320 = 1, times the constant price = price)
      expect(sma15.getResultOrThrow().toFixed(1)).toBe('10.0');
      expect(fasterSma15.getResultOrThrow().toFixed(1)).toBe('10.0');

      // Test with increasing linear data
      const sma15Linear = new SMA15();
      const fasterSma15Linear = new FasterSMA15();

      for (let i = 1; i <= 15; i++) {
        sma15Linear.add(i);
        fasterSma15Linear.add(i);
      }

      // Calculate expected result with the weights
      const weights = [-3, -6, -5, 3, 21, 46, 67, 74, 67, 46, 21, 3, -5, -6, -3];
      const sum = weights.reduce((acc, weight, idx) => acc + weight * (idx + 1), 0);
      const expectedResult = (sum / 320).toFixed(2);

      expect(sma15Linear.getResultOrThrow().toFixed(2)).toBe(expectedResult);
      expect(fasterSma15Linear.getResultOrThrow().toFixed(2)).toBe(expectedResult);
    });
  });
});