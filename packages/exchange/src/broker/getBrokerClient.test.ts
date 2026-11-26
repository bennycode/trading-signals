import {describe, expect, it} from 'vitest';
import {getBrokerClient} from './getBrokerClient.js';
import {IbkrBroker} from './ibkr/IbkrBroker.js';

/**
 * IBKR has no API keys, so the credential pair carries the Pro username and password instead.
 * Supplying them is what lets the broker start its own gateway, and `gatewayState` reports
 * whether it holds a gateway to launch — which it only does once both arrived.
 */
describe('getBrokerClient', () => {
  it('hands IBKR the credentials as the username and password that run its gateway', () => {
    const broker = getBrokerClient({
      apiKey: 'ibkr-username',
      apiSecret: 'ibkr-password',
      exchangeId: IbkrBroker.NAME,
      isPaper: false,
    });

    expect(
      broker instanceof IbkrBroker && broker.gatewayState,
      'without them the broker can only reach a gateway somebody else logged in'
    ).toBeDefined();
  });

  it('leaves IBKR pointed at an already-running gateway when no credentials are stored', () => {
    const broker = getBrokerClient({
      apiKey: '',
      apiSecret: '',
      exchangeId: IbkrBroker.NAME,
      isPaper: false,
    });

    expect(
      broker instanceof IbkrBroker && broker.gatewayState,
      'an empty pair means the gateway is somebody else’s to run, so there is no launch to report'
    ).toBeUndefined();
  });

  it('accepts a paper IBKR account, which it reaches through the paper username', () => {
    const broker = getBrokerClient({
      apiKey: 'ibkr-paper-username',
      apiSecret: 'ibkr-paper-password',
      exchangeId: IbkrBroker.NAME,
      isPaper: true,
    });

    expect(
      broker instanceof IbkrBroker,
      'IBKR paper trading is a separate login rather than a separate endpoint, so the stored pair is all that is needed'
    ).toBe(true);
  });
});
