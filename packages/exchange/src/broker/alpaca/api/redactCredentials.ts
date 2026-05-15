import axios, {type AxiosInstance} from 'axios';

function stripHeaders(headers: Record<string, unknown> | null | undefined, sensitiveHeaders: string[]): void {
  if (!headers) {
    return;
  }
  for (const name of sensitiveHeaders) {
    delete headers[name];
  }
}

// Node's HTTP client keeps the raw request as a single header blob on `request._header`,
// with each header on its own CRLF-terminated line ("Header-Name: value\r\n").
function stripRawHeaderBlob(raw: string, sensitiveHeaders: string[]): string {
  const lowercased = sensitiveHeaders.map(name => name.toLowerCase());
  return raw
    .split('\r\n')
    .filter(line => {
      const colon = line.indexOf(':');
      if (colon === -1) {
        return true;
      }
      return !lowercased.includes(line.slice(0, colon).toLowerCase());
    })
    .join('\r\n');
}

/**
 * Removes the given credential headers from an Axios error in place. Axios attaches the request
 * headers to `config`, `response.config` and `request._header`, so an unstripped error dumped to a
 * logger leaks the credentials.
 */
export function redactCredentials(error: unknown, sensitiveHeaders: string[]): unknown {
  if (!axios.isAxiosError(error)) {
    return error;
  }
  stripHeaders(error.config?.headers, sensitiveHeaders);
  stripHeaders(error.response?.config?.headers, sensitiveHeaders);
  const request = error.request;
  if (request && typeof request._header === 'string') {
    request._header = stripRawHeaderBlob(request._header, sensitiveHeaders);
  }
  return error;
}

/** Registers a response interceptor that removes the given credential headers from every rejected request. */
export function attachCredentialRedaction(client: AxiosInstance, sensitiveHeaders: string[]): void {
  client.interceptors.response.use(
    response => response,
    (error: unknown) => Promise.reject(redactCredentials(error, sensitiveHeaders))
  );
}
