import {describe, it, expect, vi, beforeEach} from 'vitest';
import type {AccountAttributes} from '../database/models/Account.js';

const {AlpacaMarketDataMock, getBrokerClientMock, mockAccountModel} = vi.hoisted(() => {
  return {
    AlpacaMarketDataMock: vi.fn(function (this: Record<string, unknown>, options: unknown) {
      this.options = options;
    }),
    getBrokerClientMock: vi.fn((_account?: unknown, _options?: {marketData?: unknown}) => ({broker: true})),
    mockAccountModel: {findByUserIdAndId: vi.fn()},
  };
});

vi.mock('@typedtrader/exchange', () => ({
  AlpacaBroker: {NAME: 'Alpaca'},
  AlpacaMarketData: AlpacaMarketDataMock,
  getBrokerClient: getBrokerClientMock,
}));

vi.mock('../database/models/Account.js', () => ({
  Account: mockAccountModel,
}));

const {getAccountBrokerClient, buildMarketDataFromAccount} = await import('./getAccountBrokerClient.js');

function makeAccount(overrides: Partial<AccountAttributes> = {}): AccountAttributes {
  return {
    id: 1,
    userId: 'user-1',
    name: 'My Account',
    exchange: 'Alpaca',
    isPaper: true,
    apiKey: 'key',
    apiSecret: 'secret',
    marketDataAccountId: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('getAccountBrokerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a client without market data when the account references none', () => {
    const account = makeAccount({exchange: 'Alpaca', marketDataAccountId: null});

    getAccountBrokerClient(account);

    expect(mockAccountModel.findByUserIdAndId).not.toHaveBeenCalled();
    expect(AlpacaMarketDataMock).not.toHaveBeenCalled();
    expect(getBrokerClientMock).toHaveBeenCalledWith(
      {exchangeId: 'Alpaca', apiKey: 'key', apiSecret: 'secret', isPaper: true},
      undefined
    );
  });

  it('resolves the referenced account into an AlpacaMarketData and passes it through', () => {
    const source = makeAccount({id: 7, exchange: 'Alpaca', isPaper: false, apiKey: 'alp-key', apiSecret: 'alp-secret'});
    mockAccountModel.findByUserIdAndId.mockReturnValue(source);
    const account = makeAccount({id: 2, exchange: 'Trading212', userId: 'user-1', marketDataAccountId: 7});

    getAccountBrokerClient(account);

    expect(mockAccountModel.findByUserIdAndId).toHaveBeenCalledWith('user-1', 7);
    // Market data must be built from the SOURCE account's own credentials and environment.
    expect(AlpacaMarketDataMock).toHaveBeenCalledWith({
      apiKey: 'alp-key',
      apiSecret: 'alp-secret',
      usePaperTrading: false,
    });
    const [, options] = getBrokerClientMock.mock.calls[0];
    expect(options?.marketData).toBeInstanceOf(AlpacaMarketDataMock);
  });

  it('throws when the referenced market-data account is missing', () => {
    mockAccountModel.findByUserIdAndId.mockReturnValue(undefined);
    const account = makeAccount({exchange: 'Trading212', marketDataAccountId: 99});

    expect(() => getAccountBrokerClient(account)).toThrow(/not found/i);
    expect(getBrokerClientMock).not.toHaveBeenCalled();
  });

  it('throws when the referenced account cannot serve as a market-data source', () => {
    const source = makeAccount({id: 5, exchange: 'Trading212'});
    mockAccountModel.findByUserIdAndId.mockReturnValue(source);
    const account = makeAccount({exchange: 'Trading212', marketDataAccountId: 5});

    expect(() => getAccountBrokerClient(account)).toThrow(/cannot be used as a market-data source/i);
    expect(getBrokerClientMock).not.toHaveBeenCalled();
  });
});

describe('buildMarketDataFromAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws for an exchange without its own market-data feed', () => {
    const source = makeAccount({exchange: 'Trading212'});
    expect(() => buildMarketDataFromAccount(source)).toThrow(/cannot be used as a market-data source/i);
  });
});
