import {NotEnoughDataError} from '../../error/index.js';
import {VolumeRatio} from './VolumeRatio.js';

describe('VolumeRatio', () => {
  it('returns the ratio of current input to trailing SMA once stable', () => {
    const ratio = new VolumeRatio(3);
    ratio.add(100);
    ratio.add(100);
    expect(ratio.isStable).toBe(false);
    ratio.add(100); // SMA = 100, ratio = 1
    expect(ratio.getResultOrThrow()).toBe(1);
    ratio.add(200); // SMA(100,100,200) = 133.33…, ratio = 200 / 133.33 = 1.5
    expect(ratio.getResultOrThrow()).toBeCloseTo(1.5, 4);
  });

  it('flags below-average inputs with ratio < 1', () => {
    const ratio = new VolumeRatio(3);
    [100, 100, 100, 50].forEach(v => ratio.add(v));
    // SMA(100,100,50) = 83.33, ratio = 50 / 83.33 = 0.6
    expect(ratio.getResultOrThrow()).toBeCloseTo(0.6, 2);
  });

  it('returns null when the trailing baseline is zero', () => {
    const ratio = new VolumeRatio(2);
    ratio.add(0);
    const r = ratio.add(0);
    expect(r).toBeNull();
    expect(ratio.isStable).toBe(false);
  });

  it('throws NotEnoughDataError before warm-up completes', () => {
    const ratio = new VolumeRatio(5);
    ratio.add(100);
    expect(() => ratio.getResultOrThrow()).toThrowError(NotEnoughDataError);
  });

  it('replaces the most recent value', () => {
    const ratio = new VolumeRatio(3);
    [100, 100, 100].forEach(v => ratio.add(v));
    const original = ratio.add(200);
    const replaced = ratio.replace(50);
    expect(replaced).not.toBe(original);
    const restored = ratio.replace(200);
    expect(restored).toBe(original);
  });
});
