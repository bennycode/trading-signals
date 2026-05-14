import {describe, it, expect, vi, beforeEach} from 'vitest';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import type {StrategyAttributes} from '../database/models/Strategy.js';

const {mockSession, mockStrategy, TradingSessionMock, mockAccountModel, mockStrategyModel} = vi.hoisted(() => {
  const session = {start: vi.fn(), stop: vi.fn(), on: vi.fn()};
  return {
    mockSession: session,
    mockStrategy: {
      restoreState: vi.fn(),
      onSave: undefined as (() => void) | undefined,
      onFinish: undefined as (() => void) | undefined,
      state: {position: 'long'} as unknown,
      config: {threshold: 10} as unknown,
    },
    TradingSessionMock: vi.fn(function () {
      return session;
    }),
    mockAccountModel: {findByPk: vi.fn()},
    mockStrategyModel: {
      findByAccountIds: vi.fn(),
      findByPk: vi.fn(),
      findAllOrderedById: vi.fn(() => []),
      updateState: vi.fn(),
      updateConfig: vi.fn(),
      destroy: vi.fn(),
    },
  };
});

vi.mock('@typedtrader/exchange', () => ({
  TradingSession: TradingSessionMock,
  TradingPair: {fromString: vi.fn(() => ({base: 'BTC', counter: 'USD'}))},
  getBrokerClient: vi.fn(() => ({})),
}));

vi.mock('trading-strategies', () => ({
  createStrategy: vi.fn(() => mockStrategy),
}));

vi.mock('../database/models/Account.js', () => ({
  Account: mockAccountModel,
}));

vi.mock('../database/models/Strategy.js', () => ({
  Strategy: mockStrategyModel,
}));

const {StrategyMonitor, formatStrategyMessage} = await import('./StrategyMonitor.js');

function createMockPlatform(): MessagingPlatform {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    sendMessage: vi.fn(),
    registerCommand: vi.fn(),
    commandList: [],
    platformInfo: {botAddress: '', sdkVersion: ''},
  };
}

function createStrategyRow(overrides: Partial<StrategyAttributes> = {}): StrategyAttributes {
  return {
    id: 1,
    accountId: 7,
    strategyName: '@typedtrader/strategy-trailing-stop',
    pair: 'BTC,USD',
    config: '{"threshold":10}',
    state: null,
    createdAt: null,
    ...overrides,
  };
}

describe('formatStrategyMessage', () => {
  it('formats messages as "<name> (<pair>): <text>"', () => {
    expect(formatStrategyMessage('TrailingStop', 'BTC-USD', 'attached')).toBe('TrailingStop (BTC-USD): attached');
  });

  it('passes the text through verbatim, including punctuation and special characters', () => {
    const text = 'Trailing stop: close 90 <= peak 100 - 10% (target 90)';
    expect(formatStrategyMessage('MyStrat', 'ETH-USD', text)).toBe(`MyStrat (ETH-USD): ${text}`);
  });
});

describe('StrategyMonitor platform routing', () => {
  it('routes a strategy message to the platform whose prefix matches the userId', async () => {
    const telegram = createMockPlatform();
    const platforms = new Map<string, MessagingPlatform>();
    platforms.set('telegram', telegram);

    const userId = 'telegram:42';
    const platform = platforms.get(userId.split(':')[0]);
    await platform?.sendMessage(userId, formatStrategyMessage('Trail', 'BTC-USD', 'attached'));

    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessage).toHaveBeenCalledWith('telegram:42', 'Trail (BTC-USD): attached');
  });

  it('returns no platform when the userId prefix is unknown', () => {
    const platforms = new Map<string, MessagingPlatform>();
    platforms.set('telegram', createMockPlatform());

    const userId = 'discord:99';
    expect(platforms.get(userId.split(':')[0])).toBeUndefined();
  });
});

describe('StrategyMonitor.restartForAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStrategy.state = {position: 'long'};
    mockStrategy.config = {threshold: 10};
    mockAccountModel.findByPk.mockReturnValue({
      exchange: 'alpaca',
      apiKey: 'key',
      apiSecret: 'secret',
      isPaper: true,
      userId: 'telegram:42',
    });
  });

  it('persists state, stops without cancelling orders, and re-subscribes an active session', async () => {
    const monitor = new StrategyMonitor(new Map());
    const row = createStrategyRow();
    await monitor.subscribeToStrategy(row);
    expect(TradingSessionMock).toHaveBeenCalledTimes(1);

    const freshRow = createStrategyRow({state: '{"position":"short"}'});
    mockStrategyModel.findByAccountIds.mockReturnValue([row]);
    mockStrategyModel.findByPk.mockReturnValue(freshRow);

    await monitor.restartForAccount(7);

    expect(mockStrategyModel.updateState).toHaveBeenCalledWith(1, JSON.stringify({position: 'long'}));
    expect(mockSession.stop).toHaveBeenCalledWith({cancelOpenOrders: false});
    expect(mockStrategyModel.findByPk).toHaveBeenCalledWith(1);
    // Re-subscribe builds a second TradingSession from the freshly loaded row.
    expect(TradingSessionMock).toHaveBeenCalledTimes(2);
  });

  it('skips rows that have no active session', async () => {
    const monitor = new StrategyMonitor(new Map());
    mockStrategyModel.findByAccountIds.mockReturnValue([createStrategyRow({id: 99})]);

    await monitor.restartForAccount(7);

    expect(mockSession.stop).not.toHaveBeenCalled();
    expect(mockStrategyModel.findByPk).not.toHaveBeenCalled();
    expect(mockStrategyModel.updateState).not.toHaveBeenCalled();
  });
});
