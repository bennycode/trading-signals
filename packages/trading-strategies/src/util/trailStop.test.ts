import {describe, expect, it} from 'vitest';
import {atrTrailStop, percentTrailStop, sizeFromRisk, trailStop} from './trailStop.js';

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

  it('rejects a lone atr without its multiple at compile time', () => {
    // @ts-expect-error - atr and atrMultiple travel as a pair; one without the other is not a valid input
    expect(() => trailStop({atr: 8, peak: 100, trailDownPct: 10})).not.toThrow();
  });

  it('rejects a request with no trail method, and guards untyped callers at runtime', () => {
    // @ts-expect-error - the type requires a percentage or a complete ATR pair; the throw guards untyped callers
    expect(() => trailStop({peak: 100})).toThrowError('trailStop requires trailDownPct, or both atr and atrMultiple');
  });
});

describe('sizeFromRisk', () => {
  it('sizes the position so that hitting the stop costs exactly the risk budget', () => {
    const quantity = sizeFromRisk({accountValue: 10_000, entryPrice: 100, riskPct: 1, stopPrice: 90});

    expect(quantity.toFixed(2), '100 of risk over a 10 per unit stop distance').toBe('10.00');
    expect(quantity.mul(10).toFixed(2), 'the loss at the stop is 1% of the account').toBe('100.00');
  });

  it('buys less of a wider-stopped instrument so both carry the same risk', () => {
    const calm = sizeFromRisk({accountValue: 10_000, entryPrice: 100, riskPct: 1, stopPrice: 98});
    const volatile = sizeFromRisk({accountValue: 10_000, entryPrice: 100, riskPct: 1, stopPrice: 80});

    expect(calm.toFixed(2)).toBe('50.00');
    expect(volatile.toFixed(2), 'ten times the stop distance, a tenth of the position').toBe('5.00');
  });

  it('refuses a stop that is not below the entry, which would invert the risk', () => {
    expect(() => sizeFromRisk({accountValue: 10_000, entryPrice: 100, riskPct: 1, stopPrice: 100})).toThrowError(
      'sizeFromRisk requires a stop below the entry price'
    );
  });
});
