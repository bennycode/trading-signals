import {NotEnoughDataError} from '../../error/index.js';
import {RVOL, type RVOLInput} from './RVOL.js';

function bar(openTimeInISO: string, volume: number): RVOLInput {
  return {openTimeInISO, volume};
}

describe('RVOL', () => {
  describe('getResultOrThrow', () => {
    it('returns null while no past session has completed', () => {
      const rvol = new RVOL(20);
      rvol.add(bar('2026-05-08T14:30:00.000Z', 1000));
      rvol.add(bar('2026-05-08T14:31:00.000Z', 1500));
      expect(rvol.isStable).toBe(false);
    });

    it('produces a result once the first prior session is complete', () => {
      const rvol = new RVOL(20);
      // Day 1: cumulative 1000, 2000 by minute 870, 871.
      rvol.add(bar('2026-05-07T14:30:00.000Z', 1000));
      rvol.add(bar('2026-05-07T14:31:00.000Z', 1000));

      // Day 2: same volume → RVOL should be 1.0 at every matching minute.
      rvol.add(bar('2026-05-08T14:30:00.000Z', 1000));
      expect(rvol.getResultOrThrow()).toBe(1);

      rvol.add(bar('2026-05-08T14:31:00.000Z', 1000));
      expect(rvol.getResultOrThrow()).toBe(1);
    });

    it('reports >1 when today trades faster than the historical curve', () => {
      const rvol = new RVOL(20);
      rvol.add(bar('2026-05-07T14:30:00.000Z', 1000));
      rvol.add(bar('2026-05-07T14:31:00.000Z', 1000));

      rvol.add(bar('2026-05-08T14:30:00.000Z', 2000));
      expect(rvol.getResultOrThrow()).toBe(2);

      rvol.add(bar('2026-05-08T14:31:00.000Z', 1500));
      // cumulative today = 3500, expected = 2000 → 1.75
      expect(rvol.getResultOrThrow()).toBe(1.75);
    });

    it('averages cumulative volume across multiple past sessions', () => {
      const rvol = new RVOL(20);
      // Day 1 minute 0: cum 1000.
      rvol.add(bar('2026-05-06T14:30:00.000Z', 1000));
      // Day 2 minute 0: cum 3000.
      rvol.add(bar('2026-05-07T14:30:00.000Z', 3000));
      // Day 3 minute 0: cum 2000 → expected = (1000 + 3000) / 2 = 2000 → RVOL = 1.
      rvol.add(bar('2026-05-08T14:30:00.000Z', 2000));
      expect(rvol.getResultOrThrow()).toBe(1);
    });

    it('uses last-known cumulative when a past session has a gap at the current minute', () => {
      const rvol = new RVOL(20);
      // Past session: only has minute 870 with cum 1000 (later minutes are gaps).
      rvol.add(bar('2026-05-07T14:30:00.000Z', 1000));
      // Today: minute 871 — past session has no entry there, fall back to minute 870 → expected 1000.
      rvol.add(bar('2026-05-08T14:31:00.000Z', 500));
      expect(rvol.getResultOrThrow()).toBe(0.5);
    });

    it('throws NotEnoughDataError before the first stable result', () => {
      const rvol = new RVOL(20);
      expect(() => rvol.getResultOrThrow()).toThrowError(NotEnoughDataError);
    });
  });

  describe('isStable', () => {
    it('flips to true once a past session has been seen', () => {
      const rvol = new RVOL(20);
      expect(rvol.isStable).toBe(false);
      rvol.add(bar('2026-05-07T14:30:00.000Z', 1000));
      expect(rvol.isStable).toBe(false);
      rvol.add(bar('2026-05-08T14:30:00.000Z', 1000));
      expect(rvol.isStable).toBe(true);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      const rvol = new RVOL(20);
      rvol.add(bar('2026-05-07T14:30:00.000Z', 1000));

      const original = rvol.add(bar('2026-05-08T14:30:00.000Z', 1500));
      const replaced = rvol.replace(bar('2026-05-08T14:30:00.000Z', 500));
      expect(replaced).not.toBe(original);
      expect(replaced).toBe(0.5);

      const restored = rvol.replace(bar('2026-05-08T14:30:00.000Z', 1500));
      expect(restored).toBe(original);
    });
  });

  describe('lookbackSessions', () => {
    it('rejects values < 1', () => {
      expect(() => new RVOL(0)).toThrowError('lookbackSessions must be >= 1');
    });

    it('evicts oldest session when more than `lookbackSessions` past sessions are seen', () => {
      const rvol = new RVOL(2);
      // Three past sessions; once on day 4 only the most recent two should count.
      rvol.add(bar('2026-05-05T14:30:00.000Z', 1000));
      rvol.add(bar('2026-05-06T14:30:00.000Z', 2000));
      rvol.add(bar('2026-05-07T14:30:00.000Z', 6000));
      // Past two sessions averaged: (2000 + 6000) / 2 = 4000.
      rvol.add(bar('2026-05-08T14:30:00.000Z', 4000));
      expect(rvol.getResultOrThrow()).toBe(1);
    });
  });

  describe('input validation', () => {
    it('throws on invalid ISO timestamp', () => {
      const rvol = new RVOL(20);
      expect(() => rvol.add(bar('not-a-date', 1000))).toThrowError('Invalid ISO timestamp');
    });
  });
});
