import {BollingerBands} from './BollingerBands.js';
import data from '../../fixtures/BB/data.json' with {type: 'json'};
import {NotEnoughDataError} from '../../error/index.js';
import {SMA} from '../../trend/SMA/SMA.js';
import {TradingSignal} from '../../types/Indicator.js';

describe('BollingerBands', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const bb = new BollingerBands(3);
      bb.updates([1, 2]);
      expect(bb.prices.length).toBe(2);
      bb.add(3);
      expect(bb.prices.length).toBe(3);
      bb.add(4);
      expect(bb.prices.length).toBe(3);
      bb.add(5);
      expect(bb.prices.length).toBe(3);
      bb.add(6);
      expect(bb.prices.length).toBe(3);
    });
  });

  describe('update', () => {
    it('stabilizes at the same input count as the SMA that defines its middle band', () => {
      const prices = [81.59, 81.06, 82.87, 83.0, 83.61, 83.15] as const;
      const interval = 5;
      const bb = new BollingerBands(interval);
      const sma = new SMA(interval);

      prices.forEach(price => {
        const bbResult = bb.add(price);
        const smaResult = sma.add(price);

        expect(bbResult?.middle ?? null).toBe(smaResult);
      });
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const bb = new BollingerBands(5, 2);
      const prices = [81.59, 81.06, 82.87, 83.0] as const;

      for (const price of prices) {
        bb.add(price);
      }

      const originalValue = 83.61;
      const replacedValue = 90;

      const originalResult = bb.add(originalValue);
      const replacedResult = bb.replace(replacedValue);

      expect(replacedResult?.middle).not.toBe(originalResult?.middle);

      const restoredResult = bb.replace(originalValue);

      expect(restoredResult?.middle).toBe(originalResult?.middle);
      expect(restoredResult?.lower).toBe(originalResult?.lower);
      expect(restoredResult?.upper).toBe(originalResult?.upper);
    });
  });

  describe('getResultOrThrow', () => {
    it('calculates Bollinger Bands with interval 20', () => {
      const bb = new BollingerBands(20);
      const offset = bb.getRequiredInputs() - 1;

      data.prices.forEach((price, index) => {
        bb.add(price);

        expect(bb.isStable).toBe(index >= offset);

        if (!bb.isStable) {
          return;
        }

        const resMiddle = Number(data.middle[index]);
        const resLower = Number(data.lower[index]);
        const resUpper = Number(data.upper[index]);

        const {lower, middle, upper} = bb.getResultOrThrow();

        expect(middle.toPrecision(12)).toEqual(resMiddle.toPrecision(12));
        expect(lower.toPrecision(12)).toEqual(resLower.toPrecision(12));
        expect(upper.toPrecision(12)).toEqual(resUpper.toPrecision(12));
      });
    });

    it('has a default standard deviation multiplier configuration', () => {
      const bb = new BollingerBands(5);
      expect(bb.interval).toBe(5);
      expect(bb.deviationMultiplier).toBe(2);
    });

    it('throws an error when there is not enough input data', () => {
      const bb = new BollingerBands(20);

      try {
        bb.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('is compatible with results from Tulip Indicators (TI)', () => {
      /*
       * Test data verified with:
       * https://tulipindicators.org/bbands
       * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L86
       */
      const inputs = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;

      const expectedLows = [
        undefined,
        undefined,
        undefined,
        undefined,
        '80.53',
        '80.99',
        '82.53',
        '82.47',
        '82.42',
        '82.44',
        '82.51',
        '83.14',
        '83.54',
        '83.87',
        '85.29',
      ] as const;

      const expectedMids = [
        undefined,
        undefined,
        undefined,
        undefined,
        '82.43',
        '82.74',
        '83.09',
        '83.32',
        '83.63',
        '83.78',
        '84.25',
        '84.99',
        '85.57',
        '86.22',
        '86.80',
      ] as const;

      const expectedUps = [
        undefined,
        undefined,
        undefined,
        undefined,
        '84.32',
        '84.49',
        '83.65',
        '84.16',
        '84.84',
        '85.12',
        '86.00',
        '86.85',
        '87.61',
        '88.57',
        '88.32',
      ] as const;

      const interval = 5;
      const bb = new BollingerBands(interval, 2);
      expect(bb.getRequiredInputs()).toBe(interval);

      inputs.forEach((price, i) => {
        const result = bb.add(price);

        if (result) {
          expect(result.lower.toFixed(2)).toBe(`${expectedLows[i]}`);
          expect(result.middle.toFixed(2)).toBe(`${expectedMids[i]}`);
          expect(result.upper.toFixed(2)).toBe(`${expectedUps[i]}`);
        } else {
          expect(expectedLows[i]).toBeUndefined();
        }
      });

      expect(bb.isStable).toBe(true);
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const bb = new BollingerBands(10);
      const signal = bb.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns BULLISH when the price breaks above the upper band', () => {
      const bb = new BollingerBands(10, 2);

      // Fill the interval with flat prices so the bands stay narrow around 50
      for (let i = 0; i < 10; i++) {
        bb.add(50);
      }

      bb.add(100);
      const signal = bb.getSignal();
      expect(signal.state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the price breaks below the lower band', () => {
      const bb = new BollingerBands(10, 2);

      for (let i = 0; i < 10; i++) {
        bb.add(50);
      }

      bb.add(0);
      const signal = bb.getSignal();
      expect(signal.state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the price stays between the bands', () => {
      const bb = new BollingerBands(10, 2);

      for (let i = 0; i < 11; i++) {
        bb.add(50 + (i % 2));
      }

      bb.add(50);
      const signal = bb.getSignal();
      expect(signal.state).toBe(TradingSignal.SIDEWAYS);
    });

    it('tracks signal state changes', () => {
      const bb = new BollingerBands(10, 2);

      // Flat prices keep the bands narrow around 50
      for (let i = 0; i < 12; i++) {
        bb.add(50);
      }

      expect(bb.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      // Spike up: the price escapes the bands to the upside
      bb.add(100);
      const signal = bb.getSignal();
      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);
    });

    it('restores previous signal state on replace', () => {
      const bb = new BollingerBands(10, 2);

      for (let i = 0; i < 12; i++) {
        bb.add(50);
      }

      expect(bb.getSignal().state).toBe(TradingSignal.SIDEWAYS);

      // Add a spike, then replace it with a normal value
      bb.add(100);
      expect(bb.getSignal().state).toBe(TradingSignal.BULLISH);

      const signal = bb.getSignal();
      bb.replace(50);
      const restoredSignal = bb.getSignal();

      expect(signal.hasChanged).toBe(true);
      expect(restoredSignal.state).toBe(TradingSignal.SIDEWAYS);
      expect(restoredSignal.hasChanged).toBe(false);
    });
  });
});
