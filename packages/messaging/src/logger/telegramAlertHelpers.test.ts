import {describe, expect, it} from 'vitest';
import {FingerprintDedup, fingerprint, formatAlertMessage, type AlertLogRecord} from './telegramAlertHelpers.js';

describe('fingerprint', () => {
  it('returns the same value for two records that differ only in numbers', () => {
    const a: AlertLogRecord = {err: {message: 'qty=0.001 too small', type: 'X'}, level: 50, msg: 'Strategy error'};
    const b: AlertLogRecord = {err: {message: 'qty=0.002 too small', type: 'X'}, level: 50, msg: 'Strategy error'};
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('returns the same value for two records that differ only in UUIDs', () => {
    const a: AlertLogRecord = {
      err: {message: 'order 7fad9195-9805-4ef8-90ef-4eaa58874bd4 failed', type: 'X'},
      level: 50,
      msg: 'WS',
    };
    const b: AlertLogRecord = {
      err: {message: 'order 1d05f123-5ad8-4b22-83c9-16790a9cc1e6 failed', type: 'X'},
      level: 50,
      msg: 'WS',
    };
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('returns the same value for two records that differ only in ISO timestamps', () => {
    const a: AlertLogRecord = {
      err: {message: 'failed at 2026-05-28T15:05:01.247Z', type: 'X'},
      level: 50,
      msg: 'X',
    };
    const b: AlertLogRecord = {
      err: {message: 'failed at 2026-05-28T15:06:00.968Z', type: 'X'},
      level: 50,
      msg: 'X',
    };
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('returns different values for structurally different errors', () => {
    const a: AlertLogRecord = {err: {message: 'qty must be > 0', type: 'X'}, level: 50, msg: 'Strategy error'};
    const b: AlertLogRecord = {err: {message: 'connection refused', type: 'X'}, level: 50, msg: 'Strategy error'};
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it('falls back to err.name when err.type is missing', () => {
    const a: AlertLogRecord = {err: {message: 'boom', name: 'TypeError'}, level: 50, msg: 'X'};
    expect(fingerprint(a)).toContain('typeerror');
  });
});

describe('formatAlertMessage', () => {
  it('includes the level label, msg, and err type/message', () => {
    const record: AlertLogRecord = {
      err: {message: '422 qty must be > 0', type: 'SimplifiedHttpError'},
      level: 50,
      msg: 'Strategy error',
    };
    const out = formatAlertMessage(record);
    expect(out).toContain('🚨 ERROR');
    expect(out).toContain('Strategy error');
    expect(out).toContain('SimplifiedHttpError: 422 qty must be > 0');
  });

  it('renders FATAL for level >= 60', () => {
    expect(formatAlertMessage({level: 60, msg: 'doomed'})).toContain('🚨 FATAL');
  });

  it('renders WARN for level 40-49', () => {
    expect(formatAlertMessage({level: 40, msg: 'sus'})).toContain('🚨 WARN');
  });

  it('includes contextual keys like strategyId/strategyName/pair', () => {
    const record: AlertLogRecord = {
      level: 50,
      msg: 'Strategy error',
      pair: 'NVDA,USD',
      strategyId: 8,
      strategyName: '@typedtrader/strategy-trailing-stop',
    };
    const out = formatAlertMessage(record);
    expect(out).toContain('strategyId: 8');
    expect(out).toContain('strategyName: @typedtrader/strategy-trailing-stop');
    expect(out).toContain('pair: NVDA,USD');
  });

  it('skips pid/hostname/v noise', () => {
    const record: AlertLogRecord = {hostname: 'ec3f42f6708c', level: 50, msg: 'X', pid: 656, v: 1};
    const out = formatAlertMessage(record);
    expect(out).not.toContain('hostname');
    expect(out).not.toContain('pid');
  });

  it('truncates very long stacks', () => {
    const stack = Array.from({length: 30}, (_, i) => `    at frame${i} (file:${i})`).join('\n');
    const record: AlertLogRecord = {err: {message: 'm', stack, type: 'E'}, level: 50, msg: 'X'};
    const out = formatAlertMessage(record);
    expect(out).toContain('frame0');
    expect(out).not.toContain('frame20');
  });

  it('truncates the full message if it exceeds the Telegram cap', () => {
    const longMsg = 'a'.repeat(10_000);
    const out = formatAlertMessage({level: 50, msg: longMsg});
    expect(out.length).toBeLessThanOrEqual(3500);
    expect(out.endsWith('…')).toBe(true);
  });

  it('includes the time as an ISO string when present', () => {
    const out = formatAlertMessage({level: 50, msg: 'X', time: 1779980701245});
    expect(out).toMatch(/time: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('FingerprintDedup', () => {
  it('returns true on the first sighting', () => {
    const dedup = new FingerprintDedup(1000, () => 0);
    expect(dedup.shouldSend('a')).toBe(true);
  });

  it('returns false on the second sighting inside the TTL window', () => {
    let now = 0;
    const dedup = new FingerprintDedup(1000, () => now);
    dedup.shouldSend('a');
    now = 500;
    expect(dedup.shouldSend('a')).toBe(false);
  });

  it('returns true again once the TTL has elapsed', () => {
    let now = 0;
    const dedup = new FingerprintDedup(1000, () => now);
    dedup.shouldSend('a');
    now = 1001;
    expect(dedup.shouldSend('a')).toBe(true);
  });

  it('keeps suppressing while the error fires continuously inside one window', () => {
    /*
     * Tight-loop case: error fires every 60s, dedup TTL is 10 min. The first call sends
     * (true), the next 9 within the window are suppressed (false). Crucially, every
     * suppressed call should also refresh the timestamp, so we don't burst at exactly
     * the 10-min mark when the loop is still going.
     */
    let now = 0;
    const dedup = new FingerprintDedup(600_000, () => now);
    expect(dedup.shouldSend('a')).toBe(true);
    for (let i = 1; i <= 9; i++) {
      now = i * 60_000;
      expect(dedup.shouldSend('a')).toBe(false);
    }
    // Still within TTL of the most recent (suppressed) sighting → stays suppressed.
    now = 10 * 60_000;
    expect(dedup.shouldSend('a')).toBe(false);
  });

  it('does not collide across distinct fingerprints', () => {
    const dedup = new FingerprintDedup(1000, () => 0);
    expect(dedup.shouldSend('a')).toBe(true);
    expect(dedup.shouldSend('b')).toBe(true);
  });
});
