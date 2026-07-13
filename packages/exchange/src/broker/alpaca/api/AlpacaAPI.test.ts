import {AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig} from 'axios';
import {shouldRetryAlpacaRequest} from './AlpacaAPI.js';

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

    it('does not retry server errors (HTTP 503) because the order may have been accepted server-side', () => {
      expect(shouldRetryAlpacaRequest(httpError(503, {}, placeOrder))).toBe(false);
    });

    it('does not retry rate limits (HTTP 429)', () => {
      expect(shouldRetryAlpacaRequest(httpError(429, {}, placeOrder))).toBe(false);
    });

    it('does not retry network errors (EAI_AGAIN)', () => {
      expect(shouldRetryAlpacaRequest(networkError('EAI_AGAIN', placeOrder))).toBe(false);
    });

    it('does not retry when axios reports the method in uppercase', () => {
      expect(shouldRetryAlpacaRequest(httpError(503, {}, {method: 'POST', url: '/v2/orders'}))).toBe(false);
    });

    it('still retries reads of the same endpoint (GET /v2/orders)', () => {
      expect(shouldRetryAlpacaRequest(httpError(503, {}, {method: 'get', url: '/v2/orders'}))).toBe(true);
    });

    it('still retries idempotent order cancellations (DELETE)', () => {
      expect(shouldRetryAlpacaRequest(httpError(503, {}, {method: 'delete', url: '/v2/orders/order-1'}))).toBe(true);
    });
  });
});
