export class SimplifiedHttpError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly url: string;
  /**
   * How long the server asked the caller to wait, in milliseconds, when the response said so.
   * Derived from the rate-limit headers; the headers themselves are deliberately not kept.
   */
  readonly retryAfterMs: number | undefined;

  constructor(params: {
    status: number | undefined;
    statusText?: string;
    data: unknown;
    url?: string;
    retryAfterMs?: number;
  }) {
    const status = params.status ?? 0;
    const statusText = params.statusText ?? 'Unknown Error';
    const url = params.url ?? 'Unknown URL';
    const bodyText = typeof params.data === 'string' ? params.data : JSON.stringify(params.data);
    super(`${status} ${statusText} at ${url}: ${bodyText}`);
    this.name = 'SimplifiedHttpError';
    this.status = status;
    this.data = params.data;
    this.url = url;
    this.retryAfterMs = params.retryAfterMs;
  }
}
