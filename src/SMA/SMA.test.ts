import {Big, FasterSMA, NotEnoughDataError, SMA} from '..';

describe('SMA', () => {
  describe('prices', () => {
    it('does not cache more prices than necessary to fill the interval', () => {
      const sma = new SMA(3);
      sma.update(1);
      sma.update(2);
      expect(sma.prices.length).toBe(2);
      sma.update(3);
      expect(sma.prices.length).toBe(3);
      sma.update(4);
      expect(sma.prices.length).toBe(3);
      sma.update(5);
      expect(sma.prices.length).toBe(3);
      sma.update(6);
      expect(sma.prices.length).toBe(3);
    });
  });

  describe('updates', () => {
    it('supports multiple updates at once', () => {
      const prices = [1, 2, 3, 4, 5];
      const interval = 5;

      const sma = new SMA(interval);
      const fasterSMA = new FasterSMA(interval);
      sma.updates(prices);
      fasterSMA.updates(prices);

      expect(sma.getResult().toFixed()).toBe('3');
      expect(fasterSMA.getResult().toFixed()).toBe('3');
    });
  });

  describe('isStable', () => {
    it('knows when there is enough input data', () => {
      const sma = new SMA(3);
      sma.update(40);
      sma.update(30);
      expect(sma.isStable).toBe(false);
      sma.update(20);
      expect(sma.isStable).toBe(true);
      sma.update('10');
      sma.update(new Big(30));
      expect(sma.getResult().valueOf()).toBe('20');
      expect(sma.lowest!.toFixed(2)).toBe('20.00');
      expect(sma.highest!.toFixed(2)).toBe('30.00');
    });
  });

  describe('getResult', () => {
    it('calculates the moving average based on the last 5 prices', () => {
      // Test data verified with:
      // https://github.com/TulipCharts/tulipindicators/blob/v0.8.0/tests/untest.txt#L359-L361
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];
      const expectations = [
        '82.426',
        '82.738',
        '83.094',
        '83.318',
        '83.628',
        '83.778',
        '84.254',
        '84.994',
        '85.574',
        '86.218',
        '86.804',
      ];
      const sma = new SMA(5);
      const fasterSMA = new FasterSMA(5);

      for (const price of prices) {
        const result = sma.update(price);
        const fasterResult = fasterSMA.update(price);

        if (result && fasterResult) {
          const expected = expectations.shift()!;
          expect(result.toFixed(3)).toBe(expected);
          expect(fasterResult.toFixed(3)).toBe(expected);
        }
      }

      expect(sma.isStable).toBe(true);
      expect(fasterSMA.isStable).toBe(true);

      expect(sma.getResult().toFixed(3)).toBe('86.804');
      expect(fasterSMA.getResult()).toBe(86.804);

      expect(sma.highest!.toFixed(2)).toBe('86.80');
      expect(fasterSMA.highest!.toFixed(2)).toBe('86.80');

      expect(sma.lowest!.toFixed(2)).toBe('82.43');
      expect(fasterSMA.lowest!.toFixed(2)).toBe('82.43');
    });

    it('throws an error when there is not enough input data', () => {
      const sma = new SMA(26);

      try {
        sma.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }

      const fasterSMA = new FasterSMA(5);

      try {
        fasterSMA.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('getResultFromBatch', () => {
    it(`doesn't crash when the array is empty`, () => {
      const result = SMA.getResultFromBatch([]);
      expect(result.valueOf()).toBe('0');
    });
  });
});
