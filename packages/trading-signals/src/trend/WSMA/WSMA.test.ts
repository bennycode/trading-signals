import {WSMA} from './WSMA.js';
import {NotEnoughDataError} from '../../error/index.js';

describe('WSMA', () => {
  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const interval = 3;

      const wsma = new WSMA(interval);
      const wsmaWithReplace = new WSMA(interval);

      const subset = [11, 12, 13];

      wsma.updates([...subset, 14, 15], false);

      wsmaWithReplace.updates([...subset, 50], false);
      wsmaWithReplace.replace(14);
      wsmaWithReplace.add(15);

      const actual = wsmaWithReplace.getResultOrThrow().toFixed();
      const expected = wsma.getResultOrThrow().toFixed();

      expect(actual).toBe(expected);
    });

    it('replaces recently added values', () => {
      const interval = 3;

      const wsma = new WSMA(interval);

      wsma.add(11);
      wsma.add(12);
      wsma.add(13);
      wsma.add(14);

      // Add the latest value
      const latestValue = 15;
      const latestResult = '13.44';

      wsma.add(latestValue);
      expect(wsma.getResultOrThrow().toFixed(2)).toBe(latestResult);

      // Replace the latest value with some other value
      const someOtherValue = 1000;
      const otherResult = '341.78';

      wsma.replace(someOtherValue);
      expect(wsma.getResultOrThrow().toFixed(2)).toBe(otherResult);

      // Replace the other value with the latest value
      wsma.replace(latestValue);
      expect(wsma.getResultOrThrow().toFixed(2)).toBe(latestResult);
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates the WSMA based on a SMA', () => {
      // Test data verified with:
      // https://runkit.com/anandaravindan/wema
      const prices = [11, 12, 13, 14, 15, 16, 18, 19, 22, 23, 23] as const;
      const expectations = ['13.00', '13.60', '14.48', '15.38', '16.71', '17.97', '18.97'] as const;
      const wsma = new WSMA(5);
      const offset = wsma.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = wsma.add(price);

        if (result) {
          const expected = expectations[i - offset];
          expect(result.toFixed(2)).toBe(expected);
        }
      });

      expect(wsma.getResultOrThrow().toFixed(2)).toBe('18.97');
    });

    it('is compatible with results from Tulip Indicators (TI)', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/atoz.txt#L299-L302
      const prices = [
        62.125, 61.125, 62.3438, 65.3125, 63.9688, 63.4375, 63, 63.7812, 63.4062, 63.4062, 62.4375, 61.8438,
      ] as const;
      const expectations = [
        undefined,
        undefined,
        undefined,
        undefined,
        '62.9750',
        '63.0675',
        '63.0540',
        '63.1995',
        '63.2408',
        '63.2739',
        '63.1066',
        '62.8540',
      ] as const;

      const interval = 5;
      const wsma = new WSMA(interval);

      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        wsma.add(price);
        if (wsma.isStable) {
          const expected = expectations[i];
          expect(wsma.getResultOrThrow().toFixed(4)).toBe(expected);
        }
      }

      expect(wsma.isStable).toBe(true);
      expect(wsma.getResultOrThrow().toFixed(4)).toBe('62.8540');
    });

    it('throws an error when there is no input data', () => {
      const wsma = new WSMA(3);

      try {
        wsma.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('throws an error when there is not enough input data', () => {
      const wsma = new WSMA(3);
      wsma.add(1);
      wsma.add(2);

      try {
        wsma.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const prices = [11, 12, 13, 14, 15, 16, 18, 19, 22, 23, 23] as const;

      const interval = 5;
      const wsma = new WSMA(interval);

      wsma.updates(prices, false);
      expect(wsma.getResultOrThrow().toFixed(2)).toBe('18.97');
    });
  });

  describe('isStable', () => {
    it('is stable when the inputs can fill the signal interval', () => {
      const wsma = new WSMA(3);
      wsma.add(1);
      wsma.add(2);
      expect(wsma.isStable).toBe(false);
      wsma.add(3);
      expect(wsma.isStable).toBe(true);
    });
  });
});
