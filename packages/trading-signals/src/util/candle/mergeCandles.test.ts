import {mergeCandles} from './mergeCandles.js';

describe('mergeCandles', () => {
  it('merges two candles into one spanning their combined range', () => {
    const candles = [
      {close: 12, high: 15, low: 8, open: 10, volume: 100},
      {close: 18, high: 20, low: 5, open: 12, volume: 150},
    ] as const;

    expect(mergeCandles(candles)).toStrictEqual({
      close: 18,
      high: 20,
      low: 5,
      open: 10,
      volume: 250,
    });
  });

  it('keeps the range of the first candle when later candles trade inside it', () => {
    const candles = [
      {close: 12, high: 20, low: 5, open: 10, volume: 100},
      {close: 14, high: 15, low: 11, open: 12, volume: 150},
    ] as const;

    expect(mergeCandles(candles)).toStrictEqual({
      close: 14,
      high: 20,
      low: 5,
      open: 10,
      volume: 250,
    });
  });

  it('returns a single candle unchanged', () => {
    const candles = [{close: 12, high: 15, low: 8, open: 10, volume: 100}] as const;

    expect(mergeCandles(candles)).toStrictEqual({
      close: 12,
      high: 15,
      low: 8,
      open: 10,
      volume: 100,
    });
  });

  it('throws when no candles are given', () => {
    expect(() => mergeCandles([])).toThrowError('Cannot merge an empty series of candles.');
  });
});
