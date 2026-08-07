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
