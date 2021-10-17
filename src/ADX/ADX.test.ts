import {Big} from 'big.js';
import {ADX} from './ADX';
import data from '../test/fixtures/ADX/data.json';
import {EMA, NotEnoughDataError} from '..';

const candles = data.candles;
const adx14results = data.interval_14;

describe('ADX', () => {
  describe('getResult', () => {
    it('uses SMMA by default for smoothing the results', () => {
      const adx = new ADX(14);
      candles.forEach((candle, index) => {
        adx.update(candle);

        if (adx.isStable) {
          const result = new Big(adx14results[index] || 0);
          expect(adx.getResult().adx.toFixed(4)).toEqual(result.toFixed(4));
        }
      });
    });

    it('supports different smoothing indicators', () => {
      // Test data taken from:
      // https://github.com/TulipCharts/tulipindicators/commit/41e59fb33cef5bc97b03d2751dab2b006525c23f
      const highs = [
        148.115, 148.226, 148.027, 149.603, 149.739, 150.782, 151.247, 151.084, 151.855, 151.874, 150.977, 151.693,
        151.877, 151.65, 151.316, 150.525, 150.072, 150.656, 150.669, 149.428, 150.144, 151.386, 151.188, 150.325,
        149.625, 149.237, 147.656, 147.188, 147.792,
      ];
      const lows = [
        147.734, 147.786, 147.787, 148.026, 149.368, 149.957, 150.467, 150.407, 150.967, 151.003, 150.69, 150.373,
        151.312, 151.028, 150.525, 149.725, 149.562, 149.885, 149.122, 149.193, 149.497, 149.887, 149.945, 149.493,
        148.715, 148.321, 146.874, 146.813, 147.335,
      ];
      const closes = [
        147.846, 148.027, 148.026, 149.603, 149.682, 150.782, 150.469, 151.084, 151.855, 151.003, 150.69, 151.693,
        151.312, 151.028, 150.525, 149.725, 150.072, 150.656, 149.122, 149.326, 150.144, 151.386, 150.232, 149.625,
        148.888, 148.321, 146.874, 147.166, 147.792,
      ];
      const adx = new ADX(14, EMA);
      for (let i = 0; i < Object.keys(highs).length; i++) {
        adx.update({
          close: closes[i],
          high: highs[i],
          low: lows[i],
        });
      }
      expect(adx.getResult().adx.toFixed(2)).toBe('20.28');
    });

    it('throws an error when there is not enough input data', () => {
      const adx = new ADX(14);

      try {
        adx.getResult();
        fail('Expected error');
      } catch (error) {
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
       * https://github.com/anandanand84/technicalindicators/blob/v3.1.0/test/directionalmovement/ADX.js#L128-L130
       */
      expect(adx.getResult().adx.toFixed(3)).toBe('17.288');
      expect(adx.getResult().mdi.toFixed(3)).toBe('24.460');
      expect(adx.getResult().pdi.toFixed(3)).toBe('27.420');
    });
  });
});
