import {TradingSignal} from '../../base/Indicator.js';
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {CoppockCurve} from './CoppockCurve.js';

/*
 * Neither Tulip Indicators (v0.9.1) nor Skender.Stock.Indicators (v3.0.0) ships a Coppock Curve
 * baseline, so all expectations are hand-derived from the published formula:
 * https://school.stockcharts.com/doku.php?id=technical_indicators:coppock_curve
 */
describe('CoppockCurve', () => {
  describe('getResultOrThrow', () => {
    it('sums both momentum readings in percent and weights the newest sum heaviest', () => {
      /*
       * Hand-derived reference (long ROC 3, short ROC 2, WMA 2):
       *
       * Prices: 200, 250, 240, 300, 288, 360
       *
       * 4th price (300): ROC(3) = (300 - 200) / 200 = 50%   | ROC(2) = (300 - 250) / 250 = 20% | sum = 70
       * 5th price (288): ROC(3) = (288 - 250) / 250 = 15.2% | ROC(2) = (288 - 240) / 240 = 20% | sum = 35.2
       * 6th price (360): ROC(3) = (360 - 240) / 240 = 50%   | ROC(2) = (360 - 300) / 300 = 20% | sum = 70
       *
       * The weighted average counts the newest sum twice as much as the one before it:
       * 5th price: (70 * 1 + 35.2 * 2) / 3 = 140.4 / 3 = 46.8
       * 6th price: (35.2 * 1 + 70 * 2) / 3 = 175.2 / 3 = 58.4
       */
      const prices = [200, 250, 240, 300, 288, 360] as const;
      const expectations = ['46.80', '58.40'] as const;
      const coppock = new CoppockCurve({longRocInterval: 3, shortRocInterval: 2, wmaInterval: 2});
      const offset = coppock.getRequiredInputs() - 1;

      prices.forEach((price, i) => {
        const result = coppock.add(price);

        if (result !== null) {
          expect(result.toFixed(2)).toBe(expectations[i - offset]);
        }
      });

      expect(coppock.isStable).toBe(true);
    });

    it('matches the closed-form value for a constant-growth series with its default configuration', () => {
      /*
       * When price grows by exactly 1% every candle, both rate-of-change readings stay constant,
       * so any weighted average of their sum must equal that constant:
       * 100 * (1.01^14 - 1) + 100 * (1.01^11 - 1) = 14.947421... + 11.566834... = 26.514255...
       */
      const coppock = new CoppockCurve();

      expect(coppock.getRequiredInputs()).toBe(24);

      for (let i = 0; i < 23; i++) {
        coppock.add(100 * 1.01 ** i);
      }

      expect(coppock.isStable).toBe(false);

      coppock.add(100 * 1.01 ** 23);

      expect(coppock.getResultOrThrow().toFixed(4)).toBe('26.5143');
    });
  });

  describe('getRequiredInputs', () => {
    it('derives the warm-up from the slower momentum window when the short interval exceeds the long one', () => {
      const prices = [100, 110, 120, 130, 140] as const;
      const coppock = new CoppockCurve({longRocInterval: 2, shortRocInterval: 3, wmaInterval: 2});

      expect(coppock.getRequiredInputs()).toBe(5);

      prices.forEach((price, i) => {
        const result = coppock.add(price);

        if (i < prices.length - 1) {
          expect(result).toBeNull();
        }
      });

      expect(coppock.getResultOrThrow().toFixed(4)).toBe('45.3535');
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const prices = [200, 250, 240, 300, 288] as const;
      const coppock = new CoppockCurve({longRocInterval: 3, shortRocInterval: 2, wmaInterval: 2});

      for (const price of prices) {
        coppock.add(price);
      }

      const originalValue = 360;
      const replacementValue = 240;

      coppock.add(originalValue);

      expect(coppock.getResultOrThrow().toFixed(2)).toBe('58.40');

      coppock.replace(replacementValue);

      expect(coppock.getResultOrThrow().toFixed(2)).toBe('-1.60');

      coppock.replace(originalValue);

      expect(coppock.getResultOrThrow().toFixed(2)).toBe('58.40');
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const coppock = new CoppockCurve({longRocInterval: 3, shortRocInterval: 2, wmaInterval: 2});

      expect(coppock.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.UNKNOWN,
      });
    });

    it('returns BULLISH when rising prices push the curve above zero', () => {
      const prices = [100, 110, 120, 130, 140] as const;
      const coppock = new CoppockCurve({longRocInterval: 3, shortRocInterval: 2, wmaInterval: 2});

      for (const price of prices) {
        coppock.add(price);
      }

      expect(coppock.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BULLISH,
      });
    });

    it('returns BEARISH when falling prices push the curve below zero', () => {
      const prices = [140, 130, 120, 110, 100] as const;
      const coppock = new CoppockCurve({longRocInterval: 3, shortRocInterval: 2, wmaInterval: 2});

      for (const price of prices) {
        coppock.add(price);
      }

      expect(coppock.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });

    it('returns SIDEWAYS when a flat market keeps the curve at zero', () => {
      const prices = [100, 100, 100, 100, 100] as const;
      const coppock = new CoppockCurve({longRocInterval: 3, shortRocInterval: 2, wmaInterval: 2});

      for (const price of prices) {
        coppock.add(price);
      }

      expect(coppock.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.SIDEWAYS,
      });
    });

    it('reports a signal change only when the curve crosses the zero line', () => {
      const risingPrices = [100, 110, 120, 130, 140, 150] as const;
      const coppock = new CoppockCurve({longRocInterval: 3, shortRocInterval: 2, wmaInterval: 2});

      for (const price of risingPrices) {
        coppock.add(price);
      }

      expect(coppock.getSignal()).toEqual({
        hasChanged: false,
        state: TradingSignal.BULLISH,
      });

      coppock.add(60);

      expect(coppock.getSignal()).toEqual({
        hasChanged: true,
        state: TradingSignal.BEARISH,
      });
    });
  });
});

testIndicatorContract({
  create: () => new CoppockCurve({longRocInterval: 3, shortRocInterval: 2, wmaInterval: 2}),
  divergentInput: 1_000,
  inputs: [200, 250, 240, 300, 288, 360, 340],
});
