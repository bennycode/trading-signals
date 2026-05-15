import {describe, expect, it} from 'vitest';
import {redactCredentials} from './redactCredentials.js';

const FAKE_KEY_ID = 'FAKE-KEY-ID';
const FAKE_SECRET = 'FAKE-SECRET';

function createAxiosError() {
  const credentialHeaders = {
    Accept: 'application/json',
    'APCA-API-KEY-ID': FAKE_KEY_ID,
    'APCA-API-SECRET-KEY': FAKE_SECRET,
  };
  return Object.assign(new Error('Request failed with status code 422'), {
    config: {headers: {...credentialHeaders}},
    isAxiosError: true,
    request: {
      _header:
        'DELETE /v2/orders/abc HTTP/1.1\r\n' +
        'Accept: application/json\r\n' +
        `APCA-API-KEY-ID: ${FAKE_KEY_ID}\r\n` +
        `APCA-API-SECRET-KEY: ${FAKE_SECRET}\r\n\r\n`,
    },
    response: {config: {headers: {...credentialHeaders}}, data: {}, status: 422},
  });
}

describe('redactCredentials', () => {
  it('redacts credentials from the request config headers', () => {
    const error = createAxiosError();

    redactCredentials(error, ['APCA-API-KEY-ID', 'APCA-API-SECRET-KEY']);

    expect(error.config.headers['APCA-API-KEY-ID']).toBeUndefined();
    expect(error.config.headers['APCA-API-SECRET-KEY']).toBeUndefined();
  });

  it('redacts credentials from the response config headers', () => {
    const error = createAxiosError();

    redactCredentials(error, ['APCA-API-KEY-ID', 'APCA-API-SECRET-KEY']);

    expect(error.response.config.headers['APCA-API-KEY-ID']).toBeUndefined();
    expect(error.response.config.headers['APCA-API-SECRET-KEY']).toBeUndefined();
  });

  it('redacts credentials from the raw request header blob', () => {
    const error = createAxiosError();

    redactCredentials(error, ['APCA-API-KEY-ID', 'APCA-API-SECRET-KEY']);

    expect(error.request._header).not.toContain(FAKE_KEY_ID);
    expect(error.request._header).not.toContain(FAKE_SECRET);
    expect(error.request._header).not.toContain('APCA-API-KEY-ID');
    expect(error.request._header).not.toContain('APCA-API-SECRET-KEY');
  });

  it('leaves non-sensitive headers untouched', () => {
    const error = createAxiosError();

    redactCredentials(error, ['APCA-API-KEY-ID', 'APCA-API-SECRET-KEY']);

    expect(error.config.headers.Accept).toBe('application/json');
    expect(error.request._header).toContain('Accept: application/json');
  });

  it('returns non-Axios errors unchanged', () => {
    const error = new Error('boom');

    expect(redactCredentials(error, ['APCA-API-KEY-ID', 'APCA-API-SECRET-KEY'])).toBe(error);
  });
});
