import {parse} from 'ms';

/**
 * Parses an interval string (e.g. "1m", "5m", "1h") and returns the value in milliseconds.
 * Throws if the interval is invalid.
 */
export function assertInterval(interval: string): number {
  const intervalMs = parse(interval);
  if (!intervalMs) {
    throw new Error('Invalid interval. Examples: 1m, 5m, 1h');
  }
  return intervalMs;
}
