import axios, {AxiosError, AxiosHeaders} from 'axios';
import {describe, expect, it} from 'vitest';
import {simplifyError} from './simplifyError.js';

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
