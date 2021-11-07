import Big from 'big.js';
import {EMA, FasterEMA, NotEnoughDataError} from '..';

import results from '../test/fixtures/EMA/results.json';
import prices from '../test/fixtures/prices.json';

const ema10results = results.weight_10;
const ema12results = results.weight_12;
const ema26results = results.weight_26;

describe('EMA', () => {
  describe('getResult', () => {
    it('calculates EMAs with weight 10', () => {
      const ema = new EMA(10);

      prices.forEach((price, index) => {
        ema.update(new Big(price));
        if (ema.isStable) {
          const actual = ema.getResult();
          const expected = new Big(ema10results[index]);
          expect(actual.toPrecision(12)).toEqual(expected.toPrecision(12));
        }
      });

      expect(ema.lowest!.toFixed(2)).toBe('38.20');
      expect(ema.highest!.toFixed(2)).toBe('81.00');
    });

    it('calculates EMAs with weight 12', () => {
      const ema = new EMA(12);

      prices.forEach((price, index) => {
        ema.update(new Big(price));
        if (ema.isStable) {
          const actual = ema.getResult();
          const expected = new Big(ema12results[index]);
          expect(actual!.toPrecision(12)).toEqual(expected.toPrecision(12));
        }
      });

      expect(ema.lowest!.toFixed(2)).toBe('40.43');
      expect(ema.highest!.toFixed(2)).toBe('81.00');
    });

    it('calculates EMAs with weight 26', () => {
      const ema = new EMA(26);

      prices.forEach((price, index) => {
        ema.update(new Big(price));
        if (ema.isStable) {
          const actual = ema.getResult();
          const expected = new Big(ema26results[index]);
          expect(actual.toPrecision(12)).toEqual(expected.toPrecision(12));
        }
      });

      expect(ema.lowest!.toFixed(2)).toBe('48.29');
      expect(ema.highest!.toFixed(2)).toBe('81.00');
    });

    it('throws an error when there is not enough input data', () => {
      const ema = new EMA(10);

      try {
        ema.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('is stable when the inputs can fill the signal interval', () => {
      const ema = new EMA(3);
      ema.update(1);
      ema.update(2);
      expect(ema.isStable).toBeFalse();
      ema.update(3);
      expect(ema.isStable).toBeTrue();
    });
  });
});

describe('FasterEMA', () => {
  describe('getResult', () => {
    it('calculates EMAs with weight 10', () => {
      const ema = new FasterEMA(10);

      prices.forEach((price, index) => {
        ema.update(price);
        if (ema.isStable) {
          const actual = ema.getResult();
          const expected = ema10results[index];
          expect(actual).toEqual(expected);
        }
      });

      expect(ema.lowest!.toFixed(2)).toBe('38.20');
      expect(ema.highest!.toFixed(2)).toBe('81.00');
    });

    it('calculates EMAs with weight 12', () => {
      const ema = new FasterEMA(12);

      prices.forEach((price, index) => {
        ema.update(price);
        if (ema.isStable) {
          const actual = ema.getResult();
          const expected = ema12results[index];
          expect(actual).toEqual(expected);
        }
      });

      expect(ema.lowest!.toFixed(2)).toBe('40.43');
      expect(ema.highest!.toFixed(2)).toBe('81.00');
    });

    it('calculates EMAs with weight 26', () => {
      const ema = new FasterEMA(26);

      prices.forEach((price, index) => {
        ema.update(price);
        if (ema.isStable) {
          const actual = ema.getResult();
          const expected = ema26results[index];
          expect(actual).toEqual(expected);
        }
      });

      expect(ema.lowest!.toFixed(2)).toBe('48.29');
      expect(ema.highest!.toFixed(2)).toBe('81.00');
    });

    it('throws an error when there is not enough input data', () => {
      const ema = new FasterEMA(10);

      try {
        ema.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('is stable when the inputs can fill the signal interval', () => {
      const ema = new FasterEMA(3);
      ema.update(1);
      ema.update(2);
      expect(ema.isStable).toBeFalse();
      ema.update(3);
      expect(ema.isStable).toBeTrue();
    });
  });
});
