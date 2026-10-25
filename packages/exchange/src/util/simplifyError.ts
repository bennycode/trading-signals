import axios, {type AxiosInstance} from 'axios';
import {SimplifiedHttpError} from './SimplifiedHttpError.js';

/**
 * Registers a response interceptor that replaces rejected Axios errors with a {@link SimplifiedHttpError}.
 *
 * This strips the verbose Axios error bloat which can leak API keys and other
 * sensitive headers into anything that serialises the error (loggers, error trackers, stdout).
 */
export function simplifyError(client: AxiosInstance) {
  client.interceptors.response.use(
    response => response,
    (error: unknown) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(error);
      }
      return Promise.reject(
        new SimplifiedHttpError({
          data: error.response?.data,
          retryAfterMs: getRetryAfterMs(error.response?.headers),
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: getResponseUrl(error.response?.request) ?? error.config?.url,
        })
      );
    }
  );
}

/**
 * A header can ask for a wait this long at most. A server asking for longer gets retried early and
 * rate-limited again, costing one request; an unbounded wait would hang the caller instead.
 */
const MAX_RETRY_AFTER_MS = 60_000;

/** Axios types its header bag loosely, so values are read back with runtime checks, not a cast. */
function readHeader(headers: unknown, name: string): string | undefined {
  if (typeof headers !== 'object' || headers === null) {
    return undefined;
  }
  const value: unknown = Reflect.get(headers, name);
  if (typeof value === 'string') {
    return value;
  }
  return typeof value === 'number' ? String(value) : undefined;
}

/**
 * How long the server itself says to wait before the next attempt. `Retry-After` is relative, so it
 * holds even when the local clock disagrees with the server's, and is therefore preferred over
 * `x-ratelimit-reset`, which is an absolute Unix time and only consulted when `Retry-After` is
 * absent. Returns `undefined` when neither header gives a wait that is still ahead of `nowMs`, so
 * the caller falls back to its own delay.
 */
export function getRetryAfterMs(headers: unknown, nowMs: number = Date.now()): number | undefined {
  const retryAfterSeconds = Number(readHeader(headers, 'retry-after'));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1_000, MAX_RETRY_AFTER_MS);
  }

  const reset = Number(readHeader(headers, 'x-ratelimit-reset'));
  if (!Number.isFinite(reset) || reset <= 0) {
    return undefined;
  }

  // Trading212 counts the reset in seconds; a value already large enough to be millis is taken as such.
  const waitMs = (reset > 1e11 ? reset : reset * 1_000) - nowMs;
  return waitMs > 0 ? Math.min(waitMs, MAX_RETRY_AFTER_MS) : undefined;
}

/**
 * Axios types `request` as `any`, but after redirects the effective URL only exists on the
 * underlying Node.js response (`request.res.responseUrl`), so it is dug out with runtime checks.
 */
function getResponseUrl(request: unknown): string | undefined {
  if (typeof request !== 'object' || request === null || !('res' in request)) {
    return undefined;
  }
  const res: unknown = request.res;
  if (typeof res !== 'object' || res === null || !('responseUrl' in res)) {
    return undefined;
  }
  return typeof res.responseUrl === 'string' ? res.responseUrl : undefined;
}
