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
          url: error.response?.request?.res?.responseUrl ?? error.config?.url,
        })
      );
    }
  );
}
