import {AxiosError, type AxiosResponse, type InternalAxiosRequestConfig} from 'axios';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SimplifiedHttpError} from '../../../util/SimplifiedHttpError.js';
import {Trading212API} from './Trading212API.js';

function createAPI(options: {usePaperTrading?: boolean} = {}) {
  return new Trading212API({
    apiKey: 'my-key',
    apiSecret: 'my-secret',
    usePaperTrading: options.usePaperTrading ?? true,
  });
}

function createHttpError(config: InternalAxiosRequestConfig, status: number) {
  const response: AxiosResponse = {config, data: {}, headers: {}, status, statusText: 'Error'};
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, undefined, response);
}

function createResponse(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {config, data, headers: {}, status: 200, statusText: 'OK'};
}

/**
 * Verifies the per-endpoint retry calibration end-to-end: a request fails with a retryable
 * HTTP 503 once per expected delay, and the retry must fire exactly after the calibrated
 * wait — not a millisecond earlier. This pins the rate-limit table in `getRetryDelay`
 * without exporting the (private) function.
 */
async function expectRetryDelays(options: {
  expectedDelays: number[];
  request: (api: Trading212API) => Promise<unknown>;
  successData: unknown;
}) {
  vi.useFakeTimers();
  const api = createAPI();
  let attempts = 0;

  api.defaults.adapter = async config => {
    attempts++;
    if (attempts <= options.expectedDelays.length) {
      throw createHttpError(config, 503);
    }
    return createResponse(config, options.successData);
  };

  const pending = options.request(api);
  await vi.advanceTimersByTimeAsync(0);
  expect(attempts).toBe(1);

  for (const [index, delay] of options.expectedDelays.entries()) {
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(attempts).toBe(index + 1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(attempts).toBe(index + 2);
  }

  await pending;
}

const accountCash = {blocked: null, free: 100, invested: 0, pieCash: 0, ppl: 0, result: 0, total: 100};
const emptyHistoryPage = {items: [], nextPagePath: null};
const order = {id: 42, status: 'NEW', strategy: 'QUANTITY', ticker: 'AAPL_US_EQ', type: 'LIMIT'};

describe('Trading212API', {concurrent: false}, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('authentication', () => {
    it('sends a Basic Authorization header built from apiKey and apiSecret', async () => {
      const api = createAPI();
      let authorization: unknown;
      api.defaults.adapter = async config => {
        authorization = config.headers.get('Authorization');
        return createResponse(config, []);
      };

      await api.getOrders();

      expect(authorization).toBe(`Basic ${Buffer.from('my-key:my-secret').toString('base64')}`);
    });

    it('targets the demo environment when paper trading', () => {
      expect(createAPI({usePaperTrading: true}).defaults.baseURL).toBe(Trading212API.URL_DEMO);
    });

    it('targets the live environment otherwise', () => {
      expect(createAPI({usePaperTrading: false}).defaults.baseURL).toBe(Trading212API.URL_LIVE);
    });
  });

  describe('retry delays', () => {
    it('waits 2s between retries of the account-cash endpoint', async () => {
      await expectRetryDelays({
        expectedDelays: [2_000],
        request: api => api.getAccountCash(),
        successData: accountCash,
      });
    });

    it('waits 5s between retries of the open-orders endpoint', async () => {
      await expectRetryDelays({expectedDelays: [5_000], request: api => api.getOrders(), successData: []});
    });

    it('waits 5s between retries of the portfolio endpoint', async () => {
      await expectRetryDelays({expectedDelays: [5_000], request: api => api.getPositions(), successData: []});
    });

    it('waits 30s between retries of the account-info endpoint', async () => {
      await expectRetryDelays({
        expectedDelays: [30_000],
        request: api => api.getAccountInfo(),
        successData: {currencyCode: 'EUR', id: 1},
      });
    });

    it('waits 50s between retries of the instruments endpoint', async () => {
      await expectRetryDelays({expectedDelays: [50_000], request: api => api.getInstruments(), successData: []});
    });

    it('waits 60s between retries of the order-history endpoint', async () => {
      await expectRetryDelays({
        expectedDelays: [60_000],
        request: api => api.getHistoryOrdersPage(),
        successData: emptyHistoryPage,
      });
    });

    it('applies the 60s history delay to paginated nextPath URLs that carry a query string', async () => {
      await expectRetryDelays({
        expectedDelays: [60_000],
        request: api => api.getHistoryOrdersPage({nextPath: '/api/v0/equity/history/orders?cursor=abc'}),
        successData: emptyHistoryPage,
      });
    });

    it('waits 1s between retries of a single-order GET', async () => {
      await expectRetryDelays({expectedDelays: [1_000], request: api => api.getOrderById(42), successData: order});
    });

    it('falls back to linear backoff for non-GET order requests (cancelOrder)', async () => {
      await expectRetryDelays({
        expectedDelays: [1_000, 2_000],
        request: api => api.cancelOrder(42),
        successData: null,
      });
    });

    it('does not retry client errors (HTTP 400) and surfaces a SimplifiedHttpError', async () => {
      const api = createAPI();
      let attempts = 0;
      api.defaults.adapter = async config => {
        attempts++;
        throw createHttpError(config, 400);
      };

      await expect(api.getAccountInfo()).rejects.toBeInstanceOf(SimplifiedHttpError);
      expect(attempts).toBe(1);
    });
  });
});
