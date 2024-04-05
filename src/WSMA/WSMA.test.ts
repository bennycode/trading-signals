import {FasterWSMA, WSMA} from './WSMA.js';
import {NotEnoughDataError} from '../error/index.js';

describe('WSMA', () => {
  describe('update', () => {
    it('can replace recently added values', () => {
      const wsma = new WSMA(5);
      const fasterWSMA = new FasterWSMA(5);
      wsma.update('11');
      fasterWSMA.update(11);
      wsma.update('12');
      fasterWSMA.update(12);
      wsma.update('13');
      fasterWSMA.update(13);
      wsma.update('14');
      fasterWSMA.update(14);
      wsma.update('15');
      fasterWSMA.update(15);
      wsma.update('16');
      fasterWSMA.update(16);
      wsma.update('20'); // this value gets replaced with the next call
      fasterWSMA.update(20); // this value gets replaced with the next call
      wsma.update('18', true);
      fasterWSMA.update(18, true);

      expect(wsma.isStable).toBe(true);
      expect(fasterWSMA.isStable).toBe(true);

      expect(wsma.getResult().toFixed(2)).toBe('14.48');
      expect(fasterWSMA.getResult().toFixed(2)).toBe('14.48');
    });
  });

  describe('getResult', () => {
    it('calculates the WSMA based on a SMA', () => {
      // Test data verified with:
      // https://runkit.com/anandaravindan/wema
      const prices = [11, 12, 13, 14, 15, 16, 18, 19, 22, 23, 23];
      const expectations = ['13.00', '13.60', '14.48', '15.38', '16.71', '17.97', '18.97'];
      const wsma = new WSMA(5);

      for (const price of prices) {
        wsma.update(price);
        if (wsma.isStable) {
          const expected = expectations.shift();
          expect(wsma.getResult().toFixed(2)).toBe(expected);
        }
      }

      expect(wsma.getResult().toFixed(2)).toBe('18.97');
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
      const fasterWSMA = new FasterWSMA(interval);

      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        wsma.update(price);
        fasterWSMA.update(price);
        if (wsma.isStable && fasterWSMA.isStable) {
          const expected = expectations[i];
          expect(wsma.getResult().toFixed(4)).toBe(expected);
          expect(fasterWSMA.getResult().toFixed(4)).toBe(expected);
        }
      }

      expect(wsma.isStable).toBe(true);
      expect(fasterWSMA.isStable).toBe(true);

      expect(wsma.getResult().toFixed(4)).toBe('62.8540');
      expect(fasterWSMA.getResult().toFixed(4)).toBe('62.8540');

      expect(wsma.highest?.toFixed(4)).toBe('63.2739');
      expect(fasterWSMA.highest?.toFixed(4)).toBe('63.2739');

      expect(wsma.lowest?.toFixed(4)).toBe('62.8540');
      expect(fasterWSMA.lowest?.toFixed(4)).toBe('62.8540');
    });

    it('throws an error when there is no input data', () => {
      const wsma = new WSMA(3);

      try {
        wsma.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('throws an error when there is not enough input data', () => {
      const wsma = new WSMA(3);
      wsma.update(1);
      wsma.update(2);

      try {
        wsma.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const prices = [11, 12, 13, 14, 15, 16, 18, 19, 22, 23, 23];

      const interval = 5;
      const wsma = new WSMA(interval);
      const fasterWSMA = new FasterWSMA(interval);

      wsma.updates(prices);
      fasterWSMA.updates(prices);

      expect(wsma.getResult().toFixed(2)).toBe('18.97');
      expect(fasterWSMA.getResult().toFixed(2)).toBe('18.97');
    });
  });

  describe('isStable', () => {
    it('is stable when the inputs can fill the signal interval', () => {
      const wsma = new WSMA(3);
      wsma.update(1);
      wsma.update(2);
      expect(wsma.isStable).toBe(false);
      wsma.update(3);
      expect(wsma.isStable).toBe(true);
    });
  });
});
