import {describe, expect, it} from 'vitest';
import {IbkrAPI} from '../api/IbkrAPI.js';
import {GATEWAY_DIR, GATEWAY_URL} from './startIbkrGateway.js';

describe('GATEWAY_URL', () => {
  it('is the address IbkrAPI talks to by default', () => {
    expect(
      GATEWAY_URL,
      'a launcher on a different port than the broker default makes every example override it to work at all'
    ).toBe(IbkrAPI.URL_GATEWAY);
  });

  it('points at the port IBKR’s shipped conf.yaml listens on', () => {
    expect(new URL(GATEWAY_URL).port, '`listenPort: 5001` in the distribution’s root/conf.yaml').toBe('5001');
  });
});

describe('GATEWAY_DIR', () => {
  it('is a usable path rather than a percent-encoded URL pathname', () => {
    expect(
      GATEWAY_DIR,
      'a file: URL pathname escapes spaces, so `existsSync` misses the gateway and re-downloads it every run'
    ).not.toContain('%');
  });

  it('is absolute, since the gateway is spawned with it as the working directory', () => {
    expect(GATEWAY_DIR.startsWith('/') || /^[A-Za-z]:/.test(GATEWAY_DIR)).toBe(true);
  });
});
