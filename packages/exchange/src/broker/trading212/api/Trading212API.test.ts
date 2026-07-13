import {AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig} from 'axios';
import {shouldRetryTrading212Request, Trading212API} from './Trading212API.js';

type Request = {method: string; url: string};

function httpError(status: number, request?: Request): AxiosError {
  const config: InternalAxiosRequestConfig = {headers: new AxiosHeaders(), ...request};
  const response: AxiosResponse = {config, data: {}, headers: new AxiosHeaders(), status, statusText: ''};
  return new AxiosError(`Request failed with status ${status}`, 'ERR_BAD_RESPONSE', config, undefined, response);
}

function networkError(code: string, request?: Request): AxiosError {
  const config: InternalAxiosRequestConfig = {headers: new AxiosHeaders(), ...request};
  return new AxiosError(`Network error: ${code}`, code, config);
}

describe('shouldRetryTrading212Request', () => {
  it('retries on rate limits (HTTP 429)', () => {
    expect(shouldRetryTrading212Request(httpError(429, {method: 'get', url: Trading212API.URL.PORTFOLIO}))).toBe(true);
  });

  it('retries on server errors (HTTP 503)', () => {
    expect(shouldRetryTrading212Request(httpError(503, {method: 'get', url: Trading212API.URL.ACCOUNT_CASH}))).toBe(
      true
    );
  });

  it('retries on DNS/network errors (EAI_AGAIN)', () => {
    expect(
      shouldRetryTrading212Request(networkError('EAI_AGAIN', {method: 'get', url: Trading212API.URL.ORDERS}))
    ).toBe(true);
  });

  it('does not retry client errors (HTTP 400)', () => {
    expect(shouldRetryTrading212Request(httpError(400, {method: 'get', url: Trading212API.URL.PORTFOLIO}))).toBe(false);
  });

  describe('order placement', () => {
    it.each([
      ['market', Trading212API.URL.ORDERS_MARKET],
      ['limit', Trading212API.URL.ORDERS_LIMIT],
    ])(
      'does not retry a %s order POST on server errors (HTTP 503) because the order may have been accepted server-side',
      (_type, url) => {
        expect(shouldRetryTrading212Request(httpError(503, {method: 'post', url}))).toBe(false);
      }
    );

    it.each([
      ['market', Trading212API.URL.ORDERS_MARKET],
      ['limit', Trading212API.URL.ORDERS_LIMIT],
    ])('does not retry a %s order POST on network errors (EAI_AGAIN)', (_type, url) => {
      expect(shouldRetryTrading212Request(networkError('EAI_AGAIN', {method: 'post', url}))).toBe(false);
    });

    it('does not retry when axios reports the method in uppercase', () => {
      expect(shouldRetryTrading212Request(httpError(503, {method: 'POST', url: Trading212API.URL.ORDERS_MARKET}))).toBe(
        false
      );
    });

    it('still retries reads of pending orders (GET)', () => {
      expect(shouldRetryTrading212Request(httpError(503, {method: 'get', url: Trading212API.URL.ORDERS}))).toBe(true);
    });

    it('still retries idempotent order cancellations (DELETE)', () => {
      expect(
        shouldRetryTrading212Request(httpError(503, {method: 'delete', url: `${Trading212API.URL.ORDERS}/1`}))
      ).toBe(true);
    });
  });
});
