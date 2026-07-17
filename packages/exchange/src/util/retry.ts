import {SimplifiedHttpError} from './SimplifiedHttpError.js';

type AsyncMethod<This, Args extends unknown[], Result> = (this: This, ...args: Args) => Promise<Result>;

export interface RetryOptions {
  /** Fixed delay in milliseconds, or a function of the attempt number (starting at 1). Defaults to `attempt * 1_000`. */
  delayMs?: number | ((attempt: number) => number);
  /** Defaults to retrying transient HTTP failures: network errors, 429 rate limits, and 5xx responses. */
  isRetryable?: (error: unknown) => boolean;
  retries?: number;
}

/** Retryable transient failures as normalized into {@link SimplifiedHttpError}: network errors (status 0), 429 rate limits, and 5xx responses. */
export function isTransientHttpError(error: unknown) {
  if (!(error instanceof SimplifiedHttpError)) {
    return false;
  }
  return error.status === 0 || error.status === 429 || (error.status >= 500 && error.status <= 599);
}

/**
 * Method decorator (TC39 standard mode) that retries transient failures. It lets each API method
 * declare its own rate-limit policy right where the endpoint is called, instead of maintaining a
 * URL-matching table in a shared HTTP interceptor that can silently fall out of sync with the
 * methods it covers.
 */
export function retry({
  delayMs = attempt => attempt * 1_000,
  isRetryable = isTransientHttpError,
  retries = Infinity,
}: RetryOptions = {}) {
  return function <This, Args extends unknown[], Result>(
    target: AsyncMethod<This, Args, Result>,
    _context: ClassMethodDecoratorContext<This, AsyncMethod<This, Args, Result>>
  ): AsyncMethod<This, Args, Result> {
    return async function (this: This, ...args: Args): Promise<Result> {
      for (let attempt = 1; ; attempt++) {
        try {
          return await target.apply(this, args);
        } catch (error) {
          if (attempt > retries || !isRetryable(error)) {
            throw error;
          }
          const delay = typeof delayMs === 'function' ? delayMs(attempt) : delayMs;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };
  };
}
