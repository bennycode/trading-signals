import {FasterSMA15, NotEnoughDataError} from '../index.js';

describe('SMA15', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary', () => {
      const interval = 1_000;
      const fasterSma15 = new FasterSMA15(interval);

      for (let i = 1; i < interval; i++) {
        fasterSma15.add(i);
      }

      expect(fasterSma15.prices.length).toBe(fasterSma15.getRequiredInputs());
    });
  });

  describe('replace', () => {
    it('replaces recently added values', () => {
      const interval = 15;
      const fasterSma15 = new FasterSMA15(interval);

      for (let i = 1; i <= interval; i++) {
        fasterSma15.add(i);
      }

      // Initial result
      const initialResult = '8.00';
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe(initialResult);

      // Replaced result
      const newValue = 100;
      const replacedResult = '7.20';

      fasterSma15.replace(newValue);
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe(replacedResult);

      // Reverted result
      fasterSma15.replace(interval);
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe(initialResult);
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const interval = 15;
      const prices = Array.from({length: interval}, (_, i) => i + 1);
      const fasterSma15 = new FasterSMA15(interval);
      fasterSma15.updates(prices);
      expect(fasterSma15.getResultOrThrow().toFixed(2)).toBe('8.00');
    });
  });

  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const interval = 15;
      const fasterSma15 = new FasterSMA15(interval);

      for (let i = 1; i <= interval - 1; i++) {
        fasterSma15.add(i);
      }

      expect(fasterSma15.isStable).toBe(false);

      fasterSma15.add(interval);
      expect(fasterSma15.isStable).toBe(true);
    });
  });

  describe('getResultOrThrow', () => {
    it('throws an error when there is not enough input data', () => {
      const interval = 15;
      const fasterSma15 = new FasterSMA15(interval);

      try {
        fasterSma15.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
