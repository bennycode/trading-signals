import {BollingerBands, FasterBollingerBands} from '../BBANDS/BollingerBands';
import {BollingerBandsWidth, FasterBollingerBandsWidth} from './BollingerBandsWidth';

describe('BollingerBandsWidth', () => {
  describe('getResult', () => {
    it('calculates the Bollinger Bands Width', () => {
      // eBay Inc. (EBAY) daily stock prices in USD on NASDAQ with CBOE BZX exchange
      const candles = [
        {open: 72.06, high: 72.07, low: 68.08, close: 68.21}, // 2021/07/30
        {open: 68.81, high: 69.36, low: 67.58, close: 68.63},
        {open: 68.75, high: 68.78, low: 67.64, close: 68.01},
        {open: 67.92, high: 68.7, low: 67.72, close: 68.0},
        {open: 67.7, high: 67.88, low: 65.58, close: 67.28},
        {open: 67.26, high: 67.28, low: 65.27, close: 65.49},
        {open: 65.74, high: 66.32, low: 65.07, close: 65.35},
        {open: 65.36, high: 67.58, low: 65.35, close: 67.31},
        {open: 67.22, high: 68.22, low: 66.95, close: 68.02},
        {open: 67.17, high: 69.04, low: 66.36, close: 68.89},
        {open: 68.64, high: 74.15, low: 68.59, close: 74.02},
        {open: 73.72, high: 76.55, low: 73.51, close: 75.25},
        {open: 74.04, high: 74.74, low: 72.66, close: 72.84},
        {open: 72.98, high: 74.14, low: 72.36, close: 72.83},
        {open: 72.36, high: 73.55, low: 72.06, close: 72.83},
        {open: 72.9, high: 73.84, low: 72.81, close: 73.36},
        {open: 73.41, high: 73.47, low: 71.78, close: 73.2},
        {open: 73.53, high: 74.0, low: 72.62, close: 72.84},
        {open: 72.85, high: 74.49, low: 72.71, close: 74.16},
        {open: 74.34, high: 75.96, low: 73.76, close: 75.64},
        {open: 75.3, high: 76.58, low: 75.19, close: 76.41},
        {open: 76.43, high: 77.83, low: 76.04, close: 77.55},
        {open: 77.49, high: 77.72, low: 76.57, close: 76.74},
        {open: 77.06, high: 77.06, low: 75.9, close: 76.15},
        {open: 76.31, high: 77.22, low: 76.12, close: 76.49},
        {open: 76.31, high: 76.95, low: 75.98, close: 76.53},
        {open: 76.41, high: 76.46, low: 74.65, close: 74.71},
        {open: 74.82, high: 74.99, low: 73.68, close: 73.93},
        {open: 73.83, high: 74.09, low: 72.94, close: 73.0},
        {open: 73.98, high: 74.27, low: 72.48, close: 72.56},
        {open: 72.96, high: 73.13, low: 71.87, close: 72.67}, // 2021/09/13
      ];

      // Test data verified with:
      // https://www.tradingview.com/support/solutions/43000501972/
      const expectations = ['0.19', '0.21', '0.21', '0.21', '0.20', '0.18', '0.15', '0.13', '0.11', '0.09', '0.09'];

      const bbw = new BollingerBandsWidth(new BollingerBands(20, 2));
      const fasterBBW = new FasterBollingerBandsWidth(new FasterBollingerBands(20, 2));

      for (const {close} of candles) {
        bbw.update(close);
        fasterBBW.update(close);
        if (bbw.isStable) {
          const expected = expectations.shift()!;
          expect(bbw.getResult().toFixed(2)).toBe(`${expected}`);
          expect(fasterBBW.getResult().toFixed(2)).toBe(expected);
        }
      }
    });
  });
});
