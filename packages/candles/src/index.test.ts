import {CandleSchema} from '@typedtrader/exchange';
import {describe, expect, it} from 'vitest';
import {datasets, getDataset} from './index.js';

describe('datasets', () => {
  it('has a unique id for every dataset', () => {
    const ids = datasets.map(dataset => dataset.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns every dataset by its id via getDataset', () => {
    for (const dataset of datasets) {
      expect(getDataset(dataset.id)).toBe(dataset);
    }
  });

  describe.each(datasets)('$id', dataset => {
    it('contains at least one candle', () => {
      expect(dataset.candles.length).toBeGreaterThan(0);
    });

    it('matches the candle schema', () => {
      const result = CandleSchema.array().safeParse(dataset.candles);

      expect(result.error?.message).toBeUndefined();
      expect(result.success).toBe(true);
    });

    it('is ordered by strictly increasing open time', () => {
      dataset.candles.forEach((candle, i) => {
        if (i > 0) {
          expect(candle.openTimeInMillis).toBeGreaterThan(dataset.candles[i - 1].openTimeInMillis);
        }
      });
    });

    it('keeps "openTimeInISO" and "openTimeInMillis" in sync', () => {
      for (const candle of dataset.candles) {
        expect(new Date(candle.openTimeInISO).getTime()).toBe(candle.openTimeInMillis);
      }
    });

    it('uses the same candle size for all candles', () => {
      const sizes = new Set(dataset.candles.map(candle => candle.sizeInMillis));

      expect(sizes.size).toBe(1);
    });
  });
});
