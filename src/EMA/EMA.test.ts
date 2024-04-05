import {EMA, FasterEMA, NotEnoughDataError} from '../index.js';
import {describe} from 'vitest';

describe('EMA', () => {
  // Test data verified with:
  // https://tulipindicators.org/ema
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ];
  const expectations = [
    '82.71',
    '82.86',
    '82.85',
    '83.23',
    '83.67',
    '83.90',
    '84.44',
    '85.14',
    '85.73',
    '86.41',
    '86.70',
  ];

  describe('update', () => {
    it('can replace recently added values', () => {
      const ema = new EMA(5);
      const fasterEMA = new FasterEMA(5);
      ema.update('81.59');
      fasterEMA.update(81.59);
      ema.update('81.06');
      fasterEMA.update(81.06);
      ema.update('82.87');
      fasterEMA.update(82.87);
      ema.update('83.0');
      fasterEMA.update(83.0);
      ema.update('90'); // this value gets replaced with the next call
      fasterEMA.update(90); // this value gets replaced with the next call
      ema.update('83.61', true);
      fasterEMA.update(83.61, true);
      expect(ema.getResult().toFixed(2)).toBe('82.71');
      expect(fasterEMA.getResult().toFixed(2)).toBe('82.71');
    });

    it('will simply add prices when there are no prices to replace', () => {
      const ema = new EMA(5);
      ema.update(prices[0], true);
      ema.update(prices[1]);
      ema.update(prices[2]);
      ema.update(prices[3]);
      ema.update(prices[4]);
      expect(ema.getResult().toFixed(2)).toBe('82.71');

      const fasterEMA = new FasterEMA(5);
      fasterEMA.update(prices[0], true);
      fasterEMA.update(prices[1]);
      fasterEMA.update(prices[2]);
      fasterEMA.update(prices[3]);
      fasterEMA.update(prices[4]);
    });
  });

  describe('getResult', () => {
    it('calculates the Exponential Moving Average over a period of 5', () => {
      const ema = new EMA(5);
      const fasterEMA = new FasterEMA(5);
      for (const price of prices) {
        ema.update(price);
        fasterEMA.update(price);
        if (ema.isStable && fasterEMA.isStable) {
          const expected = expectations.shift();
          expect(ema.getResult().toFixed(2)).toBe(expected!);
          expect(fasterEMA.getResult().toFixed(2)).toBe(expected!);
        }
      }
      expect(ema.getResult().toFixed(2)).toBe('86.70');
      expect(fasterEMA.getResult().toFixed(2)).toBe('86.70');
    });

    it('throws an error when there is not enough input data', () => {
      const ema = new EMA(10);

      try {
        ema.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
        expect(ema.isStable).toBe(false);
      }

      const fasterEMA = new FasterEMA(10);

      try {
        fasterEMA.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
        expect(fasterEMA.isStable).toBe(false);
      }
    });
  });
});
