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
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: getResponseUrl(error.response?.request) ?? error.config?.url,
        })
      );
    }
  );
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
