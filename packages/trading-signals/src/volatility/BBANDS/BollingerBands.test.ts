import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {BollingerBands} from './BollingerBands.js';
import data from '../../fixtures/BB/data.json' with {type: 'json'};
import {TradingSignal} from '../../base/Indicator.js';

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

  describe('getResultOrThrow', () => {
    it('calculates Bollinger Bands with interval 20', () => {
      const bb = new BollingerBands(20);

      data.prices.forEach((price, index) => {
        bb.add(price);

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

    it('emits the first result as soon as the interval is filled', () => {
      const bb = new BollingerBands(5, 2);
      const prices = [10, 11, 12, 13, 14] as const;

      bb.updates(prices.slice(0, -1));

      expect(bb.isStable, 'four prices do not fill an interval of five').toBe(false);

      const result = bb.add(prices[4]);

      expect(bb.isStable, 'the fifth price completes the interval').toBe(true);
      expect(result?.middle, 'the first band averages all five prices').toBe(12);
    });

    it('is compatible with results from Tulip Indicators (TI)', {tags: ['tulipindicators']}, () => {
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

      for (let i = 0; i < inputs.length; i++) {
        const price = inputs[i];
        bb.add(price);
        if (bb.isStable) {
          const {lower, middle, upper} = bb.getResultOrThrow();
          const expectedLow = expectedLows[i];
          const expectedMid = expectedMids[i];
          const expectedUp = expectedUps[i];
          expect(lower.toFixed(2)).toBe(`${expectedLow}`);
          expect(middle.toFixed(2)).toBe(`${expectedMid}`);
          expect(upper.toFixed(2)).toBe(`${expectedUp}`);
        }
      }
    });
  });

  describe('update', () => {
    it('recalculates the bands when replacing the latest price', () => {
      const bb = new BollingerBands(5, 2);
      const prices = [81.59, 81.06, 82.87, 83.0, 83.61, 83.15] as const;

      bb.updates(prices);

      const originalResult = bb.getResultOrThrow();
      const replacedResult = bb.replace(90);

      expect(replacedResult?.middle, 'a replacement recalculates the bands').not.toBe(originalResult.middle);

      const restoredResult = bb.replace(83.15);

      expect(restoredResult?.middle, 'replacing back restores the original bands').toBe(originalResult.middle);
    });

    it('changes nothing when the latest price is replaced with the same value', () => {
      const bb = new BollingerBands(5, 2);
      const prices = [81.59, 81.06, 82.87, 83.0, 83.61, 83.15] as const;

      bb.updates(prices);

      const resultBefore = bb.getResultOrThrow();

      bb.replace(83.15);

      expect(bb.getResultOrThrow(), 'replacing a price with itself is a no-op').toEqual(resultBefore);
      expect(bb.isStable, 'and it stays stable').toBe(true);
    });

    it('keeps calculating when a price of zero drops out of the window', () => {
      const bb = new BollingerBands(3, 2);

      bb.updates([0, 1, 2, 3]);

      expect(bb.getResultOrThrow().middle, 'a zero drop-out must not suppress the calculation').toBe(2);
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
      for (let i = 0; i < 11; i++) {
        bb.add(50);
      }

      bb.add(100);
      const signal = bb.getSignal();
      expect(signal.state).toBe(TradingSignal.BULLISH);
    });

    it('returns BEARISH when the price breaks below the lower band', () => {
      const bb = new BollingerBands(10, 2);

      for (let i = 0; i < 11; i++) {
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
      const signal = bb.getSignal();
      expect(signal.state).toBe(TradingSignal.BULLISH);
      expect(signal.hasChanged).toBe(true);

      bb.replace(50);
      const restoredSignal = bb.getSignal();
      expect(restoredSignal.state).toBe(TradingSignal.SIDEWAYS);
      expect(restoredSignal.hasChanged).toBe(false);
    });
  });
});

testIndicatorContract({
  create: () => new BollingerBands(5, 2),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15],
});
