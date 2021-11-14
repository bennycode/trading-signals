import {ADX} from './ADX';
import {NotEnoughDataError} from '..';

describe('ADX', () => {
  describe('getResult', () => {
    it('throws an error when there is not enough input data', () => {
      const adx = new ADX(14);

      try {
        adx.getResult();
        fail('Expected error');
      } catch (error) {
        expect(adx.isStable).toBeFalse();
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('returns the directional indicators (+DI & -DI)', () => {
      /**
       * Test data from:
       * https://github.com/anandanand84/technicalindicators/blob/v3.1.0/test/directionalmovement/ADX.js#L23-L28
       */
      const data = {
        close: [
          29.87, 30.24, 30.1, 28.9, 28.92, 28.48, 28.56, 27.56, 28.47, 28.28, 27.49, 27.23, 26.35, 26.33, 27.03, 26.22,
          26.01, 25.46, 27.03, 27.45, 28.36, 28.43, 27.95, 29.01, 29.38, 29.36, 28.91, 30.61, 30.05, 30.19, 31.12,
          30.54, 29.78, 30.04, 30.49, 31.47, 32.05, 31.97, 31.13, 31.66, 32.64, 32.59, 32.19, 32.1, 32.93, 33.0, 31.94,
        ],
        high: [
          30.2, 30.28, 30.45, 29.35, 29.35, 29.29, 28.83, 28.73, 28.67, 28.85, 28.64, 27.68, 27.21, 26.87, 27.41, 26.94,
          26.52, 26.52, 27.09, 27.69, 28.45, 28.53, 28.67, 29.01, 29.87, 29.8, 29.75, 30.65, 30.6, 30.76, 31.17, 30.89,
          30.04, 30.66, 30.6, 31.97, 32.1, 32.03, 31.63, 31.85, 32.71, 32.76, 32.58, 32.13, 33.12, 33.19, 32.52,
        ],
        low: [
          29.41, 29.32, 29.96, 28.74, 28.56, 28.41, 28.08, 27.43, 27.66, 27.83, 27.4, 27.09, 26.18, 26.13, 26.63, 26.13,
          25.43, 25.35, 25.88, 26.96, 27.14, 28.01, 27.88, 27.99, 28.76, 29.14, 28.71, 28.93, 30.03, 29.39, 30.14,
          30.43, 29.35, 29.99, 29.52, 30.94, 31.54, 31.36, 30.92, 31.2, 32.13, 32.23, 31.97, 31.56, 32.21, 32.63, 31.76,
        ],
      };

      const adx = new ADX(14);

      for (let i = 0; i < Object.keys(data.low).length; i++) {
        adx.update({
          close: data.close[i],
          high: data.high[i],
          low: data.low[i],
        });
      }

      /**
       * Expectation from:
       * https://github.com/anandanand84/technicalindicators/blob/v3.1.0/test/directionalmovement/ADX.js#L128
       */
      expect(adx.isStable).toBeTrue();
      expect(adx.getResult().adx.toFixed(3)).toBe('17.288');
    });
  });
});
