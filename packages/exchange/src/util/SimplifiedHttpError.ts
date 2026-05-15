export class SimplifiedHttpError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly url: string;

  constructor(params: {status: number | undefined; statusText?: string; data: unknown; url?: string}) {
    const status = params.status ?? 0;
    const statusText = params.statusText ?? 'Unknown Error';
    const url = params.url ?? 'Unknown URL';
    const bodyText = typeof params.data === 'string' ? params.data : JSON.stringify(params.data);
    super(`${status} ${statusText} at ${url}: ${bodyText}`);
    this.name = 'SimplifiedHttpError';
    this.status = status;
    this.data = params.data;
    this.url = url;
  }
}
