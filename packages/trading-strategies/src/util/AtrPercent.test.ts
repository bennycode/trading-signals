import {describe, expect, it} from 'vitest';
import {AtrPercent, atrToPercent} from './AtrPercent.js';

describe('atrToPercent', () => {
  it('expresses ATR as a percentage of price', () => {
    expect(atrToPercent(52.64, 740.53)).toBeCloseTo(7.11, 2);
  });

  it('is scale-invariant: the same percentage for proportional price and ATR', () => {
    expect(atrToPercent(0.7, 10)).toBeCloseTo(atrToPercent(70, 1_000), 10);
  });
});

describe('AtrPercent', () => {
  const candles = [
    {close: 10, high: 11, low: 9},
    {close: 11, high: 12, low: 10},
    {close: 12, high: 13, low: 11},
    {close: 13, high: 14, low: 12},
  ] as const;

  it('is not ready until the underlying ATR is stable', () => {
    const atrPercent = new AtrPercent(3);

    atrPercent.add(candles[0]);
    atrPercent.add(candles[1]);

    expect(atrPercent.isReady).toBe(false);
    expect(atrPercent.value).toBeNull();
    expect(atrPercent.atr).toBeNull();
  });

  it('returns the ATR as a percent of the latest close once warmed up', () => {
    const atrPercent = new AtrPercent(3);

    candles.forEach(candle => atrPercent.add(candle));

    // ATR settles at 2 over these candles; latest close is 13 → 2 / 13 * 100.
    expect(atrPercent.atr).toBe(2);
    expect(atrPercent.value).toBeCloseTo((2 / 13) * 100, 10);
  });
});
