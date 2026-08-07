import axios, {AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig} from 'axios';
import {z} from 'zod';
import {AlpacaAPI, shouldRetryAlpacaRequest} from './AlpacaAPI.js';
import type {Order} from './schema/OrderSchema.js';

type Request = {method: string; url: string};

function httpError(status: number, data: unknown = {}, request?: Request): AxiosError {
  const config: InternalAxiosRequestConfig = {headers: new AxiosHeaders(), ...request};
  const response: AxiosResponse = {config, data, headers: new AxiosHeaders(), status, statusText: ''};
  return new AxiosError(`Request failed with status ${status}`, 'ERR_BAD_RESPONSE', config, undefined, response);
}

function networkError(code: string, request?: Request): AxiosError {
  const config: InternalAxiosRequestConfig = {headers: new AxiosHeaders(), ...request};
  return new AxiosError(`Network error: ${code}`, code, config);
}

describe('shouldRetryAlpacaRequest', () => {
  it('retries on rate limits (HTTP 429)', () => {
    expect(shouldRetryAlpacaRequest(httpError(429))).toBe(true);
  });

  it('retries on server errors (HTTP 503)', () => {
    expect(shouldRetryAlpacaRequest(httpError(503))).toBe(true);
  });

  it('retries on DNS/network errors (EAI_AGAIN)', () => {
    expect(shouldRetryAlpacaRequest(networkError('EAI_AGAIN'))).toBe(true);
  });

  it('does not retry client errors (HTTP 400)', () => {
    expect(shouldRetryAlpacaRequest(httpError(400))).toBe(false);
  });

  it('does not retry PDT-violation rejections (Alpaca code 40310100)', () => {
    expect(shouldRetryAlpacaRequest(httpError(403, {code: 40310100}))).toBe(false);
  });

  it('does not retry short-selling rejections (Alpaca code 40310000)', () => {
    expect(shouldRetryAlpacaRequest(httpError(403, {code: 40310000}))).toBe(false);
  });

  describe('order placement (POST /v2/orders)', () => {
    const placeOrder: Request = {method: 'post', url: '/v2/orders'};

    it('retries server errors (HTTP 503) because the client order id keeps a re-submission from duplicating the order', () => {
      expect(shouldRetryAlpacaRequest(httpError(503, {}, placeOrder))).toBe(true);
    });

    it('retries network errors (EAI_AGAIN)', () => {
      expect(shouldRetryAlpacaRequest(networkError('EAI_AGAIN', placeOrder))).toBe(true);
    });

    it('does not retry business rejections (Alpaca code 40310100)', () => {
      expect(shouldRetryAlpacaRequest(httpError(403, {code: 40310100}, placeOrder))).toBe(false);
    });
  });
});

describe('postOrder', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resends the identical client_order_id on a retry, so the broker can reconcile the submission', async () => {
    const order: Order = {
      asset_class: 'us_equity',
      asset_id: 'asset-1',
      canceled_at: null,
      client_order_id: 'client-id-123',
      created_at: '2026-01-01T00:00:00Z',
      expired_at: null,
      extended_hours: false,
      failed_at: null,
      filled_at: null,
      filled_avg_price: null,
      filled_qty: '0',
      id: 'order-1',
      legs: null,
      limit_price: null,
      notional: '200',
      qty: null,
      replaced_at: null,
      replaced_by: null,
      replaces: null,
      side: 'buy',
      status: 'accepted',
      stop_price: null,
      submitted_at: '2026-01-01T00:00:00Z',
      symbol: 'SHOP',
      time_in_force: 'day',
      type: 'market',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const createSpy = vi.spyOn(axios, 'create');
    const api = new AlpacaAPI({apiKey: 'test', apiSecret: 'test', usePaperTrading: true});
    const firstCreated = createSpy.mock.results[0];
    const tradingClient = firstCreated?.type === 'return' ? firstCreated.value : undefined;
    if (!tradingClient) {
      throw new Error('Expected AlpacaAPI to create a trading client.');
    }

    const RequestBodySchema = z.looseObject({client_order_id: z.string()});
    const sentClientOrderIds: string[] = [];

    tradingClient.defaults.adapter = (config: InternalAxiosRequestConfig) => {
      const body = RequestBodySchema.parse(JSON.parse(String(config.data)));
      sentClientOrderIds.push(body.client_order_id);
      if (sentClientOrderIds.length === 1) {
        const response: AxiosResponse = {
          config,
          data: {},
          headers: new AxiosHeaders(),
          status: 503,
          statusText: 'Service Unavailable',
        };
        return Promise.reject(
          new AxiosError('Request failed with status 503', 'ERR_BAD_RESPONSE', config, undefined, response)
        );
      }
      const response: AxiosResponse = {config, data: order, headers: new AxiosHeaders(), status: 200, statusText: 'OK'};
      return Promise.resolve(response);
    };

    vi.useFakeTimers();
    const pendingOrder = api.postOrder({
      client_order_id: 'client-id-123',
      notional: '200',
      side: 'buy',
      symbol: 'SHOP',
      time_in_force: 'day',
      type: 'market',
    });
    // Silence unhandled-rejection noise while the fake clock advances past the retry delay
    const settledOrder = pendingOrder.catch((error: unknown) => {
      throw error;
    });
    await vi.advanceTimersByTimeAsync(1_000);
    const placedOrder = await settledOrder;

    expect(sentClientOrderIds).toEqual(['client-id-123', 'client-id-123']);
    expect(placedOrder.id).toBe('order-1');
  });
});
