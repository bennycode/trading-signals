import {shouldRetryAlpacaRequest} from './AlpacaAPI.js';
import {SimplifiedHttpError} from '../../../util/SimplifiedHttpError.js';

function httpError(status: number, data: unknown = {}) {
  return new SimplifiedHttpError({data, status});
}

// Network failures (e.g. EAI_AGAIN) carry no HTTP response, so simplifyError normalizes them to status 0.
function networkError(code: string) {
  return new SimplifiedHttpError({data: code, status: undefined});
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

  it('does not retry errors that were not normalized by simplifyError', () => {
    expect(shouldRetryAlpacaRequest(new Error('boom'))).toBe(false);
  });
});
