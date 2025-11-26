import {BollingerBands} from '../BBANDS/BollingerBands.js';
import {BollingerBandsWidth} from './BollingerBandsWidth.js';

describe('BollingerBandsWidth', () => {
  describe('getResultOrThrow', () => {
    it('calculates the Bollinger Bands Width (BBW)', () => {
      // eBay Inc. (EBAY) daily stock prices in USD on NASDAQ with CBOE BZX exchange
      const candles = [
        {close: 68.21, high: 72.07, low: 68.08, open: 72.06}, // 2021/07/30
        {close: 68.63, high: 69.36, low: 67.58, open: 68.81},
        {close: 68.01, high: 68.78, low: 67.64, open: 68.75},
        {close: 68.0, high: 68.7, low: 67.72, open: 67.92},
        {close: 67.28, high: 67.88, low: 65.58, open: 67.7},
        {close: 65.49, high: 67.28, low: 65.27, open: 67.26},
        {close: 65.35, high: 66.32, low: 65.07, open: 65.74},
        {close: 67.31, high: 67.58, low: 65.35, open: 65.36},
        {close: 68.02, high: 68.22, low: 66.95, open: 67.22},
        {close: 68.89, high: 69.04, low: 66.36, open: 67.17},
        {close: 74.02, high: 74.15, low: 68.59, open: 68.64},
        {close: 75.25, high: 76.55, low: 73.51, open: 73.72},
        {close: 72.84, high: 74.74, low: 72.66, open: 74.04},
        {close: 72.83, high: 74.14, low: 72.36, open: 72.98},
        {close: 72.83, high: 73.55, low: 72.06, open: 72.36},
        {close: 73.36, high: 73.84, low: 72.81, open: 72.9},
        {close: 73.2, high: 73.47, low: 71.78, open: 73.41},
        {close: 72.84, high: 74.0, low: 72.62, open: 73.53},
        {close: 74.16, high: 74.49, low: 72.71, open: 72.85},
        {close: 75.64, high: 75.96, low: 73.76, open: 74.34},
        {close: 76.41, high: 76.58, low: 75.19, open: 75.3},
        {close: 77.55, high: 77.83, low: 76.04, open: 76.43},
        {close: 76.74, high: 77.72, low: 76.57, open: 77.49},
        {close: 76.15, high: 77.06, low: 75.9, open: 77.06},
        {close: 76.49, high: 77.22, low: 76.12, open: 76.31},
        {close: 76.53, high: 76.95, low: 75.98, open: 76.31},
        {close: 74.71, high: 76.46, low: 74.65, open: 76.41},
        {close: 73.93, high: 74.99, low: 73.68, open: 74.82},
        {close: 73.0, high: 74.09, low: 72.94, open: 73.83},
        {close: 72.56, high: 74.27, low: 72.48, open: 73.98},
        {close: 72.67, high: 73.13, low: 71.87, open: 72.96}, // 2021/09/13
      ] as const;

      // Test data verified with:
      // https://www.tradingview.com/support/solutions/43000501972/
      const expectations = [
        '0.19',
        '0.21',
        '0.21',
        '0.21',
        '0.20',
        '0.18',
        '0.15',
        '0.13',
        '0.11',
        '0.09',
        '0.09',
      ] as const;

      const interval = 20;
      const bbw = new BollingerBandsWidth(new BollingerBands(interval, 2));
      const offset = bbw.getRequiredInputs();

      expect(bbw.getRequiredInputs()).toBe(interval);

      candles.forEach(({close}, i) => {
        bbw.add(close);
        if (bbw.isStable) {
          const expected = expectations[i - offset];
          expect(bbw.getResultOrThrow().toFixed(2)).toBe(`${expected}`);
        }
      });
    });
  });
});
