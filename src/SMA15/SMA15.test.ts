import {describe} from 'vitest';
import {FasterSMA15, NotEnoughDataError, SMA15} from '../index.js';

describe('SMA15', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary', () => {
      const interval = 1_000;
      const sma15 = new SMA15(interval);
      const fasterSma15 = new FasterSMA15(interval);

      for (let i = 1; i < interval; i++) {
        sma15.add(i);
        fasterSma15.add(i);
      }

      expect(sma15['prices'].length).toBe(sma15.getRequiredInputs());
      expect(fasterSma15.prices.length).toBe(fasterSma15.getRequiredInputs());
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const interval = 15;
      const sma15 = new SMA15(interval);
      const fasterSma15 = new FasterSMA15(interval);

      for (let i = 1; i <= interval; i++) {
        sma15.add(i);
        fasterSma15.add(i);
      }

      // Initial result
      const initialResult = '8.00';
      expect(sma15.getResultOrThrow().toFixed(2)).toBe(initialResult);
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe(initialResult);

      // Replaced result
      const newValue = 100;
      const replacedResult = '7.20';

      sma15.replace(newValue);
      fasterSma15.replace(newValue);

      expect(sma15.getResultOrThrow().toFixed(2)).toBe(replacedResult);
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe(replacedResult);

      // Reverted result
      sma15.replace(interval);
      fasterSma15.replace(interval);

      expect(sma15.getResultOrThrow().toFixed(2)).toBe(initialResult);
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe(initialResult);
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const interval = 15;
      const prices = Array.from({length: interval}, (_, i) => i + 1);
      const sma15 = new SMA15(interval);
      const fasterSma15 = new FasterSMA15(interval);

      sma15.updates(prices);
      fasterSma15.updates(prices);

      expect(sma15.getResultOrThrow().toFixed(2)).toBe('8.00');
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe('8.00');
    });
  });

  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const interval = 15;
      const sma15 = new SMA15(interval);
      const fasterSma15 = new FasterSMA15(interval);

      for (let i = 1; i <= interval - 1; i++) {
        sma15.add(i);
        fasterSma15.add(i);
      }

      expect(sma15.isStable).toBe(false);
      expect(fasterSma15.isStable).toBe(false);

      sma15.add(interval);
      fasterSma15.add(interval);

      expect(sma15.isStable).toBe(true);
      expect(fasterSma15.isStable).toBe(true);
    });
  });

  describe('getResultOrThrow', () => {
    it('throws an error when there is not enough input data', () => {
      const interval = 15;
      const sma15 = new SMA15(interval);
      const fasterSma15 = new FasterSMA15(interval);

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
  });
});
