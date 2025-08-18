import {REI} from './REI.js';

describe('REI', () => {
  const testData = [
    {
      close: 453.13,
      high: 456.19,
      index: 1,
      low: 450.43,
      open: 450.77,
      timestamp: '2025-05-15T00:00:00Z',
    },
    {
      close: 454.27,
      high: 454.36,
      index: 2,
      low: 448.73,
      open: 452.05,
      timestamp: '2025-05-16T00:00:00Z',
    },
    {
      close: 458.87,
      high: 459.58,
      index: 3,
      low: 450.8,
      open: 450.88,
      timestamp: '2025-05-19T00:00:00Z',
    },
    {
      close: 458.17,
      high: 458.34,
      index: 4,
      low: 454.32,
      open: 455.59,
      timestamp: '2025-05-20T00:00:00Z',
    },
    {
      close: 452.57,
      high: 457.78,
      index: 5,
      low: 451.81,
      open: 454.57,
      timestamp: '2025-05-21T00:00:00Z',
    },
    {
      close: 454.86,
      high: 460.25,
      index: 6,
      low: 453.9,
      open: 454.95,
      timestamp: '2025-05-22T00:00:00Z',
    },
    {
      close: 450.18,
      high: 453.69,
      index: 7,
      low: 448.91,
      open: 449.98,
      timestamp: '2025-05-23T00:00:00Z',
    },
    {
      close: 460.69,
      high: 460.95,
      index: 8,
      low: 456.11,
      open: 456.48,
      timestamp: '2025-05-27T00:00:00Z',
    },
    {
      close: 457.36,
      high: 462.52,
      index: 9,
      low: 456.93,
      open: 461.22,
      timestamp: '2025-05-28T00:00:00Z',
    },
    {
      close: 458.68,
      high: 461.72,
      index: 10,
      low: 455.31,
      open: 461.55,
      timestamp: '2025-05-29T00:00:00Z',
    },
    {
      close: 460.36,
      high: 461.68,
      index: 11,
      low: 455.54,
      open: 459.71,
      timestamp: '2025-05-30T00:00:00Z',
    },
    {
      close: 461.97,
      high: 462.11,
      index: 12,
      low: 456.89,
      open: 457.14,
      timestamp: '2025-06-02T00:00:00Z',
    },
    {
      close: 462.97,
      high: 464.14,
      index: 13,
      low: 460.86,
      open: 461.47,
      timestamp: '2025-06-03T00:00:00Z',
    },
    {
      close: 463.87,
      high: 465.69,
      index: 14,
      low: 463.02,
      open: 464.0,
      timestamp: '2025-06-04T00:00:00Z',
    },
    {
      close: 467.68,
      high: 469.65,
      index: 15,
      low: 464.03,
      open: 464.95,
      timestamp: '2025-06-05T00:00:00Z',
    },
    {
      close: 470.38,
      high: 473.33,
      index: 16,
      low: 468.78,
      open: 470.08,
      timestamp: '2025-06-06T00:00:00Z',
    },
  ] as const;

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const result = '-0.64';
      const replacedResult = '-0.01';
      const lastCandle = testData[testData.length - 1];
      const replacementCandle = {close: 3_000, high: 4_000, low: 2_000};

      const interval = 8;
      const rei = new REI(interval);

      rei.updates(testData);
      expect(rei.getResultOrThrow().toFixed(2)).toBe(result);

      rei.replace(replacementCandle);
      expect(rei.getResultOrThrow().toFixed(2)).toBe(replacedResult);

      rei.replace(lastCandle);
      expect(rei.getResultOrThrow().toFixed(2)).toBe(result);
    });
  });

  describe('getResultOrThrow', () => {
    it('creates a signal', () => {
      const interval = 8;
      const rei = new REI(interval);
      rei.updates(testData);
      expect(rei.getResultOrThrow().toFixed(2)).toBe('-0.64');
    });

    it('detects neutral momentum', () => {
      const interval = 8;
      const rei = new REI(interval);

      const inputs = Array(rei.getRequiredInputs()).fill({
        close: 180,
        high: 180,
        low: 180,
      });

      rei.updates(inputs);

      expect(rei.getResultOrThrow()).toBe(0);
    });

    it('detects an oversold condition', () => {
      const interval = 8;
      const rei = new REI(interval);

      for (let i = 0; i < rei.getRequiredInputs(); i++) {
        rei.add({close: 95 + i, high: 100 + i, low: 90 + i});
      }

      const lowVolatilityCandles = [
        {close: 100, high: 100.1, low: 99.9},
        {close: 100.05, high: 100.15, low: 99.95},
        {close: 99.95, high: 100.05, low: 99.85},
        {close: 100.02, high: 100.12, low: 99.92},
      ];

      for (const candle of lowVolatilityCandles) {
        rei.add(candle);
      }

      expect(rei.getResultOrThrow().toFixed(2)).toBe('-14.99');
    });

    it('returns null until there are enough data points', () => {
      const interval = 8;
      const rei = new REI(interval);

      for (let i = 0; i < 15; i++) {
        rei.add({close: i, high: i, low: i});
      }

      expect(rei.getResult()).toBeNull();
    });
  });
});
