import {describe, expect, it} from 'vitest';
import {atrTrailStop, percentTrailStop, trailStop} from './trailStop.js';

describe('percentTrailStop', () => {
  it('places the stop the given percentage below the peak', () => {
    expect(percentTrailStop(100, 10).toFixed(2)).toBe('90.00');
  });

  it('reproduces the STX exit: a 10% trail off an 837.6 peak lands at 753.84', () => {
    expect(percentTrailStop('837.6', '10').toFixed(2)).toBe('753.84');
  });
});

describe('atrTrailStop', () => {
  it('places the stop the ATR multiple below the peak', () => {
    expect(atrTrailStop(100, 5, 3).toFixed(2)).toBe('85.00');
  });

  it('widens the stop as volatility grows', () => {
    const calm = atrTrailStop(100, 1, 3);
    const volatile = atrTrailStop(100, 8, 3);

    expect(volatile.lt(calm)).toBe(true);
  });
});

describe('trailStop', () => {
  it('behaves like a percentage trail when only trailDownPct is given', () => {
    expect(trailStop({peak: 100, trailDownPct: 10}).toFixed(2)).toBe('90.00');
  });

  it('returns the looser (lower) stop when the ATR stop is wider than the percentage stop', () => {
    // Percentage stop = 90; ATR stop = 100 - 3*8 = 76. The wider ATR stop wins.
    expect(trailStop({atr: 8, atrMultiple: 3, peak: 100, trailDownPct: 10}).toFixed(2)).toBe('76.00');
  });

  it('keeps the percentage stop when it is already looser than the ATR stop', () => {
    // Percentage stop = 80; ATR stop = 100 - 3*1 = 97. The wider percentage stop wins.
    expect(trailStop({atr: 1, atrMultiple: 3, peak: 100, trailDownPct: 20}).toFixed(2)).toBe('80.00');
  });

  it('ignores a lone atr without a multiple', () => {
    expect(trailStop({atr: 8, peak: 100, trailDownPct: 10}).toFixed(2)).toBe('90.00');
  });

  it('throws when neither a percentage nor a complete ATR pair is supplied', () => {
    expect(() => trailStop({peak: 100})).toThrowError('trailStop requires trailDownPct, or both atr and atrMultiple');
  });
});
