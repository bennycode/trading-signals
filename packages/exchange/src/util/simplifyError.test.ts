import axios, {AxiosError, AxiosHeaders} from 'axios';
import {describe, expect, it} from 'vitest';
import {getRetryAfterMs, simplifyError} from './simplifyError.js';
import {SimplifiedHttpError} from './SimplifiedHttpError.js';

function createClientThatFailsWith(error: AxiosError) {
  const client = axios.create();
  client.defaults.adapter = async () => {
    throw error;
  };
  simplifyError(client);
  return client;
}

function buildAxiosError(overrides: Partial<AxiosError>) {
  const error = new AxiosError('Request failed');
  error.isAxiosError = true;
  Object.assign(error, overrides);
  return error;
}

describe('simplifyError', () => {
  it('rejects the original error when it is not an AxiosError', async () => {
    const client = axios.create();
    const original = new Error('boom');
    client.defaults.adapter = async () => {
      throw original;
    };
    simplifyError(client);

    await expect(client.get('/whatever')).rejects.toBe(original);
  });

  it('exposes status, data and url on the rejected error so callers can introspect', async () => {
    const client = createClientThatFailsWith(
      buildAxiosError({
        config: {headers: new AxiosHeaders(), url: 'https://api.alpaca.markets/v2/orders/abc'},
        response: {
          config: {headers: new AxiosHeaders()},
          data: {code: 42210000, message: 'order is already in "filled" state'},
          headers: {},
          request: {res: {responseUrl: 'https://api.alpaca.markets/v2/orders/abc'}},
          status: 422,
          statusText: 'Unprocessable Entity',
        },
      })
    );

    await expect(client.get('/v2/orders/abc')).rejects.toMatchObject({
      data: {code: 42210000, message: 'order is already in "filled" state'},
      status: 422,
      url: 'https://api.alpaca.markets/v2/orders/abc',
    });
    await expect(client.get('/v2/orders/abc')).rejects.toBeInstanceOf(SimplifiedHttpError);
  });

  it('does not leak credential headers via the rejected error', async () => {
    const FAKE_KEY_ID = 'FAKE-KEY-ID';
    const FAKE_SECRET = 'FAKE-SECRET';
    const credentialHeaders = new AxiosHeaders({
      'APCA-API-KEY-ID': FAKE_KEY_ID,
      'APCA-API-SECRET-KEY': FAKE_SECRET,
    });
    const client = createClientThatFailsWith(
      buildAxiosError({
        config: {headers: credentialHeaders, url: 'https://api.alpaca.markets/v2/orders/abc'},
        response: {
          config: {headers: credentialHeaders},
          data: {message: 'forbidden'},
          headers: {},
          request: {res: {responseUrl: 'https://api.alpaca.markets/v2/orders/abc'}},
          status: 403,
          statusText: 'Forbidden',
        },
      })
    );

    try {
      await client.get('/v2/orders/abc');
      expect.fail('expected request to reject');
    } catch (caught) {
      const serialised = JSON.stringify(caught, Object.getOwnPropertyNames(caught));
      expect(serialised).not.toContain(FAKE_KEY_ID);
      expect(serialised).not.toContain(FAKE_SECRET);
    }
  });
});

describe('getRetryAfterMs', () => {
  /** Headers copied from a real Trading212 429 on `GET /api/v0/equity/orders`. */
  const rateLimited = {
    'retry-after': '4',
    'x-ratelimit-limit': '1',
    'x-ratelimit-period': '5',
    'x-ratelimit-remaining': '0',
    'x-ratelimit-reset': '1792611356',
    'x-ratelimit-used': '1',
  };

  it('prefers the relative Retry-After header, which no clock skew can distort', () => {
    expect(getRetryAfterMs(rateLimited, 1_792_611_351_000)).toBe(4_000);
  });

  it('falls back to the absolute reset timestamp, read as Unix seconds', () => {
    const {'retry-after': _unused, ...withoutRetryAfter} = rateLimited;

    expect(getRetryAfterMs(withoutRetryAfter, 1_792_611_351_000), '1792611356s is 5s after now').toBe(5_000);
  });

  it('states no window once the reset time has passed', () => {
    const {'retry-after': _unused, ...withoutRetryAfter} = rateLimited;

    expect(getRetryAfterMs(withoutRetryAfter, 1_792_611_400_000)).toBeUndefined();
  });

  it('caps a wait that a header asks to stretch beyond a minute', () => {
    expect(getRetryAfterMs({'retry-after': '3600'}), 'retried early and rate-limited again at worst').toBe(60_000);
  });

  it('states no window when the response carries no rate-limit headers', () => {
    expect(getRetryAfterMs({'content-type': 'application/json'})).toBeUndefined();
    expect(getRetryAfterMs(undefined)).toBeUndefined();
  });
});
