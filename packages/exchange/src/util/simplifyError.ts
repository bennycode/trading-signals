import axios, {type AxiosInstance} from 'axios';

/**
 * Registers a response interceptor that replaces rejected Axios errors with a plain `Error`.
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
      const url = error.response?.request?.res?.responseUrl ?? error.config?.url ?? 'Unknown URL';
      const status = error.response?.status ?? 0;
      const statusText = error.response?.statusText ?? 'Unknown Error';
      const body = error.response?.data;
      const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
      return Promise.reject(new Error(`${status} ${statusText} at ${url}: ${bodyText}`));
    }
  );
}
