import {NotEnoughDataError} from '../../error/index.js';
import {RVOL} from './RVOL.js';

describe('RVOL', () => {
  it('matches the Aron Groups worked example: 10-day avg 200K, today 300K → RVOL 1.5', () => {
    const rvol = new RVOL(10);
    for (let i = 0; i < 10; i++) {
      rvol.add(200_000);
    }
    expect(rvol.isStable).toBe(false);
    rvol.add(300_000);
    expect(rvol.getResultOrThrow()).toBe(1.5);
  });

  it('produces null while warming up; first ratio comes on the (period + 1)th input', () => {
    const rvol = new RVOL(3);
    expect(rvol.add(100)).toBeNull();
    expect(rvol.add(100)).toBeNull();
    expect(rvol.add(100)).toBeNull();
    expect(rvol.isStable).toBe(false);
    rvol.add(200);
    expect(rvol.getResultOrThrow()).toBe(2);
  });

  it('excludes the current input from the baseline', () => {
    /*
     * Three prior values [100, 100, 100], today = 200.
     * If today were included: baseline = (100+100+100+200)/4 = 125 → ratio = 1.6.
     * Excluded:                baseline = (100+100+100)/3 = 100 → ratio = 2.0.
     */
    const rvol = new RVOL(3);
    [100, 100, 100, 200].forEach(v => rvol.add(v));
    expect(rvol.getResultOrThrow()).toBe(2);
  });

  it('flags below-average inputs with ratio < 1', () => {
    const rvol = new RVOL(3);
    [100, 100, 100, 50].forEach(v => rvol.add(v));
    expect(rvol.getResultOrThrow()).toBe(0.5);
  });

  it('returns null when the trailing baseline is zero', () => {
    const rvol = new RVOL(2);
    rvol.add(0);
    rvol.add(0);
    const r = rvol.add(100);
    expect(r).toBeNull();
    expect(rvol.isStable).toBe(false);
  });

  it('clears a previously stable result when the baseline drops to zero', () => {
    const rvol = new RVOL(2);
    rvol.add(100);
    rvol.add(100);
    rvol.add(200); // baseline 100, ratio 2 → stable
    expect(rvol.isStable).toBe(true);
    expect(rvol.getResultOrThrow()).toBe(2);

    // Force the next baseline to zero by replacing both prior values.
    rvol.replace(100); // restore window to [100, 100], result back to undefined-then-2
    expect(rvol.isStable).toBe(true);
    // Now add two zeros so the next add sees baseline 0.
    const rvol2 = new RVOL(2);
    rvol2.add(100);
    rvol2.add(50);
    rvol2.add(75); // baseline 75, ratio 1 → stable
    expect(rvol2.isStable).toBe(true);

    rvol2.add(0);
    expect(rvol2.isStable).toBe(true); // window still has non-zero priors
    rvol2.add(0);
    // priors become [0, 0] for the next baseline; next add returns null and clears result.
    const r = rvol2.add(50);
    expect(r).toBeNull();
    expect(rvol2.isStable).toBe(false);
    expect(() => rvol2.getResultOrThrow()).toThrow();
  });

  it('shifts the window forward as new values arrive', () => {
    const rvol = new RVOL(3);
    [100, 100, 100].forEach(v => rvol.add(v));
    // 4th input: baseline = mean(100,100,100) = 100. Today 200 → 2.0
    expect(rvol.add(200)).toBe(2);
    // 5th input: baseline = mean(100,100,200) = 133.33. Today 200 → 200 / 133.33
    rvol.add(200);
    expect(rvol.getResultOrThrow()).toBeCloseTo(200 / ((100 + 100 + 200) / 3), 4);
  });

  it('throws NotEnoughDataError before warm-up completes', () => {
    const rvol = new RVOL(5);
    rvol.add(100);
    expect(() => rvol.getResultOrThrow()).toThrowError(NotEnoughDataError);
  });

  it('replaces the most recent value', () => {
    const rvol = new RVOL(3);
    [100, 100, 100].forEach(v => rvol.add(v));
    const original = rvol.add(200);
    const replaced = rvol.replace(50);
    expect(replaced).not.toBe(original);
    expect(replaced).toBe(0.5);
    const restored = rvol.replace(200);
    expect(restored).toBe(original);
  });

  it('rewinds exactly one update on replace (after multiple results)', () => {
    /*
     * Sequence the indicator through several stable results, then verify that replacing
     * the most recent value lands on the SAME result we would have got if we'd called
     * add() with the replacement value instead. Equivalence is the contract of replace().
     */
    const setup = [100, 100, 100] as const;
    const drive = [200, 300] as const;

    const a = new RVOL(3);
    setup.forEach(v => a.add(v));
    drive.forEach(v => a.add(v));
    a.replace(400);

    const b = new RVOL(3);
    setup.forEach(v => b.add(v));
    b.add(drive[0]);
    b.add(400);

    expect(a.getResultOrThrow()).toBe(b.getResultOrThrow());
  });

  it('rejects period < 1', () => {
    expect(() => new RVOL(0)).toThrowError('period must be >= 1');
  });

  it('throws when replace() is called before any input has been added', () => {
    const rvol = new RVOL(3);

    expect(() => rvol.replace(100)).toThrowError('Cannot replace before any input has been added.');
  });

  it('keeps memory bounded by trimming the prior-volumes buffer', () => {
    const rvol = new RVOL(2);
    const inputs = [10, 20, 30, 40, 50, 60, 70] as const;
    const expectations = [null, null, 30 / 15, 40 / 25, 50 / 35, 60 / 45, 70 / 55] as const;

    inputs.forEach((volume, i) => {
      const result = rvol.add(volume);
      const expected = expectations[i];

      if (expected === null) {
        expect(result).toBeNull();
      } else {
        expect(result).toBeCloseTo(expected, 6);
      }
    });

    expect(rvol.isStable).toBe(true);
  });
});
