import axios, {type AxiosInstance} from 'axios';

const REDACTED = '[REDACTED]';

// Headers that carry Alpaca credentials and must never reach logs.
const SENSITIVE_HEADERS = ['APCA-API-KEY-ID', 'APCA-API-SECRET-KEY'];

function redactHeaders(headers: Record<string, unknown> | null | undefined): void {
  if (!headers) {
    return;
  }
  for (const name of SENSITIVE_HEADERS) {
    if (headers[name] !== undefined) {
      headers[name] = REDACTED;
    }
  }
}

// Node's HTTP client keeps the raw request as a single header blob on `request._header`.
function redactRawHeaderBlob(raw: string): string {
  return raw.replace(new RegExp(`^(${SENSITIVE_HEADERS.join('|')}): .*$`, 'gim'), `$1: ${REDACTED}`);
}

/**
 * Strips Alpaca API credentials from an Axios error in place. Axios attaches the request headers to
 * `config`, `response.config` and `request._header`, so an unredacted error dumped to a logger
 * leaks the API key and secret.
 */
export function redactCredentials(error: unknown): unknown {
  if (!axios.isAxiosError(error)) {
    return error;
  }
  redactHeaders(error.config?.headers);
  redactHeaders(error.response?.config?.headers);
  const request = error.request;
  if (request && typeof request._header === 'string') {
    request._header = redactRawHeaderBlob(request._header);
  }
  return error;
}

/** Registers a response interceptor that redacts credentials from every rejected request. */
export function attachCredentialRedaction(client: AxiosInstance): void {
  client.interceptors.response.use(
    response => response,
    (error: unknown) => Promise.reject(redactCredentials(error))
  );
}
