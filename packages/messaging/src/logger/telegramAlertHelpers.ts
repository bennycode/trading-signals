/*
 * Pure helpers used by the Telegram pino transport. Kept in their own module so they can
 * be unit-tested without spinning up a worker thread or mocking pino's transport plumbing.
 */

/** Shape of the pino log record fields we look at. Anything else is preserved as context. */
export type AlertLogRecord = {
  level: number;
  time?: number;
  msg?: string;
  err?: {
    type?: string;
    name?: string;
    message?: string;
    stack?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const MAX_TELEGRAM_LENGTH = 3500; // Telegram caps at 4096; leave headroom for formatting overhead.
const MAX_STACK_LINES = 8;
const SKIPPED_CONTEXT_KEYS = new Set(['level', 'time', 'msg', 'err', 'pid', 'hostname', 'v']);

/**
 * Compute a stable fingerprint for an error log record so a tight loop emitting the same
 * error every minute collapses to a single alert (within the dedup window).
 *
 * Strategy: hash msg + err.type + err.message, but normalise volatile substrings
 * (numbers, UUIDs, timestamps) so structurally identical errors group together — e.g.
 * "qty=0.001" and "qty=0.002" produce the same fingerprint.
 */
export function fingerprint(record: AlertLogRecord): string {
  const msg = record.msg ?? '';
  const errType = record.err?.type ?? record.err?.name ?? '';
  const errMessage = record.err?.message ?? '';
  const raw = `${msg}|${errType}|${errMessage}`;
  return normaliseForFingerprint(raw);
}

function normaliseForFingerprint(input: string): string {
  return (
    input
      // ISO timestamps → 'T'
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, 'T')
      // UUIDs → 'U'
      .replace(/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/gi, 'U')
      // Any standalone number (incl. decimals, negatives) → 'N'
      .replace(/-?\d+(?:\.\d+)?/g, 'N')
      .toLowerCase()
  );
}

/**
 * Format a pino log record into a human-readable Telegram message. Truncates anything
 * that would push past Telegram's 4 KB message limit and keeps the most useful fields
 * (msg, err, key context like strategyId/strategyName/pair) front-and-centre.
 */
export function formatAlertMessage(record: AlertLogRecord): string {
  const lines: string[] = [];
  lines.push(`🚨 ${levelLabel(record.level)}`);
  if (record.msg) {
    lines.push('', record.msg);
  }

  if (record.err) {
    const errType = record.err.type ?? record.err.name ?? 'Error';
    const errMessage = record.err.message ?? '';
    lines.push('', `${errType}: ${errMessage}`);
    if (typeof record.err.stack === 'string' && record.err.stack.length > 0) {
      lines.push('', truncateStack(record.err.stack));
    }
  }

  const contextLines = collectContext(record);
  if (contextLines.length > 0) {
    lines.push('', ...contextLines);
  }

  if (typeof record.time === 'number') {
    lines.push('', `time: ${new Date(record.time).toISOString()}`);
  }

  return truncate(lines.join('\n'), MAX_TELEGRAM_LENGTH);
}

function levelLabel(level: number): string {
  if (level >= 60) {
    return 'FATAL';
  }
  if (level >= 50) {
    return 'ERROR';
  }
  if (level >= 40) {
    return 'WARN';
  }
  return `LEVEL ${level}`;
}

function collectContext(record: AlertLogRecord): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (SKIPPED_CONTEXT_KEYS.has(key)) {
      continue;
    }
    if (value === undefined || value === null) {
      continue;
    }
    lines.push(`${key}: ${stringifyContextValue(value)}`);
  }
  return lines;
}

function stringifyContextValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserialisable]';
  }
}

function truncateStack(stack: string): string {
  const lines = stack.split('\n').slice(0, MAX_STACK_LINES);
  return lines.join('\n');
}

function truncate(input: string, max: number): string {
  if (input.length <= max) {
    return input;
  }
  return `${input.slice(0, max - 1)}…`;
}

/**
 * Tiny TTL cache used by the transport to dedup repeated identical errors within a window.
 * Implemented as a Map with explicit eviction on read so we don't grow unbounded.
 */
export class FingerprintDedup {
  readonly #ttlMs: number;
  readonly #now: () => number;
  readonly #seen = new Map<string, number>();

  constructor(ttlMs: number, now: () => number = Date.now) {
    this.#ttlMs = ttlMs;
    this.#now = now;
  }

  /**
   * Returns true if the fingerprint was NOT in the cache (i.e. the caller should send),
   * false if it's still within the TTL window. Either way the timestamp is refreshed
   * so a continuously-firing error stays suppressed instead of bursting every TTL.
   */
  shouldSend(fp: string): boolean {
    const now = this.#now();
    this.#prune(now);
    const last = this.#seen.get(fp);
    this.#seen.set(fp, now);
    if (last === undefined) {
      return true;
    }
    return now - last >= this.#ttlMs;
  }

  #prune(now: number): void {
    for (const [fp, ts] of this.#seen) {
      if (now - ts >= this.#ttlMs) {
        this.#seen.delete(fp);
      }
    }
  }
}
