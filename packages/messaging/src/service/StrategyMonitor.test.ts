import {describe, it, expect, vi, beforeEach} from 'vitest';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import type {StrategyAttributes} from '../database/models/Strategy.js';

const {mockAccountModel, mockSession, mockStrategy, mockStrategyModel, TradingSessionMock} = vi.hoisted(() => {
  const session = {on: vi.fn(), start: vi.fn(), stop: vi.fn()};
  return {
    mockAccountModel: {findByPk: vi.fn()},
    mockSession: session,
    mockStrategy: {
      config: {threshold: 10},
      onFinish: undefined as (() => void) | undefined,
      onSave: undefined as (() => void) | undefined,
      restoreState: vi.fn(),
      state: {position: 'long'},
    },
    mockStrategyModel: {
      destroy: vi.fn(),
      findAllOrderedById: vi.fn(() => []),
      findByAccountIds: vi.fn(),
      findByPk: vi.fn(),
      updateConfig: vi.fn(),
      updateState: vi.fn(),
    },
    /*
     * Must stay a regular function: the code under test calls `new TradingSession(...)`,
     * and arrow functions are not constructable.
     */
    // eslint-disable-next-line prefer-arrow-callback
    TradingSessionMock: vi.fn(function () {
      return session;
    }),
  };
});

vi.mock('@typedtrader/exchange', () => ({
  getBrokerClient: vi.fn(() => ({})),
  TradingPair: {fromString: vi.fn(() => ({base: 'BTC', counter: 'USD'}))},
  TradingSession: TradingSessionMock,
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

const {formatStrategyMessage, StrategyMonitor} = await import('./StrategyMonitor.js');
const {PlatformDispatcher} = await import('./PlatformDispatcher.js');

function createMockPlatform(): MessagingPlatform {
  return {
    commandList: [],
    platformInfo: {botAddress: '', sdkVersion: ''},
    registerCommand: vi.fn(),
    sendMessage: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function createStrategyRow(overrides: Partial<StrategyAttributes> = {}): StrategyAttributes {
  return {
    accountId: 7,
    config: '{"threshold":10}',
    createdAt: null,
    id: 1,
    pair: 'BTC,USD',
    state: null,
    strategyName: '@typedtrader/strategy-trailing-stop',
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
      apiKey: 'key',
      apiSecret: 'secret',
      exchange: 'alpaca',
      isPaper: true,
      userId: 'telegram:42',
    });
  });

  it('persists state, stops without cancelling orders, and re-subscribes an active session', async () => {
    const monitor = new StrategyMonitor(new PlatformDispatcher(new Map()));
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
    const monitor = new StrategyMonitor(new PlatformDispatcher(new Map()));
    mockStrategyModel.findByAccountIds.mockReturnValue([createStrategyRow({id: 99})]);

    await monitor.restartForAccount(7);

    expect(mockSession.stop).not.toHaveBeenCalled();
    expect(mockStrategyModel.findByPk).not.toHaveBeenCalled();
    expect(mockStrategyModel.updateState).not.toHaveBeenCalled();
  });
});
