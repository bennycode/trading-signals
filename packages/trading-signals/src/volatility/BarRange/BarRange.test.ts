import {NotEnoughDataError} from '../../error/index.js';
import {BarRange} from './BarRange.js';

describe('BarRange', () => {
  it('returns the SMA of per-bar ranges once stable', () => {
    const range = new BarRange(3);
    range.add({high: 102, low: 100}); // 2
    range.add({high: 105, low: 100}); // 5
    expect(range.isStable).toBe(false);
    range.add({high: 108, low: 100}); // 8 → SMA(2,5,8) = 5
    expect(range.getResultOrThrow()).toBe(5);
    range.add({high: 101, low: 100}); // 1 → SMA(5,8,1) = 4.666…
    expect(range.getResultOrThrow()).toBeCloseTo(4.6667, 4);
  });

  it('throws NotEnoughDataError before warm-up completes', () => {
    const range = new BarRange(5);
    range.add({high: 10, low: 9});
    expect(() => range.getResultOrThrow()).toThrowError(NotEnoughDataError);
  });

  it('replaces the most recently added bar', () => {
    const range = new BarRange(3);
    range.add({high: 102, low: 100});
    range.add({high: 105, low: 100});
    const original = range.add({high: 108, low: 100});
    const replaced = range.replace({high: 110, low: 100});
    expect(replaced).not.toBe(original);
    const restored = range.replace({high: 108, low: 100});
    expect(restored).toBe(original);
  });
});
