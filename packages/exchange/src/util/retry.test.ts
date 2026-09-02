import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {retry} from './retry.js';
import {SimplifiedHttpError} from './SimplifiedHttpError.js';

function rateLimitError() {
  return new SimplifiedHttpError({data: 'Too Many Requests', status: 429});
}

// Sequential: fake timers are process-global, so concurrently running tests would advance each other's clocks.
describe.sequential('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries transient failures until the method succeeds', async () => {
    const attempts = vi.fn();

    class Api {
      @retry({delayMs: 1_000})
      async load() {
        attempts();
        if (attempts.mock.calls.length < 3) {
          throw rateLimitError();
        }
        return 'ok';
      }
    }

    const pending = new Api().load();
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toBe('ok');
    expect(attempts).toHaveBeenCalledTimes(3);
  });

  it('retries network failures, which arrive with status 0', async () => {
    const attempts = vi.fn();

    class Api {
      @retry({delayMs: 1_000})
      async load() {
        attempts();
        if (attempts.mock.calls.length < 2) {
          throw new SimplifiedHttpError({data: 'EAI_AGAIN', status: undefined});
        }
        return 'ok';
      }
    }

    const pending = new Api().load();
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toBe('ok');
    expect(attempts).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-retryable errors without retrying', async () => {
    const attempts = vi.fn();
    const badRequest = new SimplifiedHttpError({data: 'Bad Request', status: 400});

    class Api {
      @retry()
      async load() {
        attempts();
        throw badRequest;
      }
    }

    await expect(new Api().load()).rejects.toBe(badRequest);
    expect(attempts, 'a 400 is a client mistake that repeating cannot fix').toHaveBeenCalledTimes(1);
  });

  it('gives up once the retry limit is exhausted', async () => {
    const attempts = vi.fn();

    class Api {
      @retry({delayMs: 10, retries: 2})
      async load() {
        attempts();
        throw rateLimitError();
      }
    }

    const pending = new Api().load();
    const assertion = expect(pending).rejects.toBeInstanceOf(SimplifiedHttpError);
    await vi.advanceTimersByTimeAsync(20);

    await assertion;
    expect(attempts, 'the initial call plus two retries').toHaveBeenCalledTimes(3);
  });

  it('waits according to the attempt-based delay function', async () => {
    const attempts = vi.fn();

    class Api {
      @retry({delayMs: attempt => attempt * 500})
      async load() {
        attempts();
        if (attempts.mock.calls.length < 3) {
          throw rateLimitError();
        }
        return 'ok';
      }
    }

    const pending = new Api().load();

    await vi.advanceTimersByTimeAsync(499);
    expect(attempts, 'the first retry waits 500 ms').toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(attempts).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toBe('ok');
    expect(attempts, 'the second retry waits 1000 ms').toHaveBeenCalledTimes(3);
  });

  it('honors a custom retry predicate', async () => {
    const attempts = vi.fn();

    class Api {
      @retry({delayMs: 10, isRetryable: error => error instanceof RangeError, retries: 5})
      async load() {
        attempts();
        if (attempts.mock.calls.length < 2) {
          throw new RangeError('out of range');
        }
        return 'ok';
      }
    }

    const pending = new Api().load();
    await vi.advanceTimersByTimeAsync(10);

    await expect(pending).resolves.toBe('ok');
    expect(attempts).toHaveBeenCalledTimes(2);
  });

  it('preserves access to private fields of the decorated instance', async () => {
    class Api {
      readonly #token = 'secret';

      @retry()
      async whoAmI() {
        return this.#token;
      }
    }

    await expect(new Api().whoAmI()).resolves.toBe('secret');
  });
});
