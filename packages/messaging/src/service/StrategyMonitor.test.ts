import {describe, it, expect, vi, beforeEach} from 'vitest';
import {OrderSide, OrderSizeBelowMinimumError} from '@typedtrader/exchange';
import {logger} from '../logger.js';
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

vi.mock('@typedtrader/exchange', async importActual => {
  const actual = await importActual<Record<string, unknown>>();
  return {
    ...actual,
    getBrokerClient: vi.fn(() => ({})),
    TradingPair: {fromString: vi.fn(() => ({base: 'BTC', counter: 'USD'}))},
    TradingSession: TradingSessionMock,
  };
});

vi.mock('trading-strategies', () => ({
  createStrategy: vi.fn(() => mockStrategy),
}));

vi.mock('../logger.js', () => ({
  logger: {debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn()},
}));

vi.mock('../database/models/Account.js', () => ({
  Account: mockAccountModel,
}));

vi.mock('../database/models/Strategy.js', () => ({
  Strategy: mockStrategyModel,
}));

const {formatStrategyMessage, STRATEGY_ERROR_LOG_MESSAGE, StrategyMonitor} = await import('./StrategyMonitor.js');
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
    const message = formatStrategyMessage('Trail', 'BTC-USD', 'attached');
    const platform = platforms.get(userId.split(':')[0]);
    await platform?.sendMessage(userId, message);

    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessage).toHaveBeenCalledWith(userId, message);
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

describe('StrategyMonitor session error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountModel.findByPk.mockReturnValue({
      apiKey: 'key',
      apiSecret: 'secret',
      exchange: 'alpaca',
      isPaper: true,
      userId: 'telegram:42',
    });
  });

  function getSessionErrorHandler(): (error: Error) => void {
    const call = mockSession.on.mock.calls.find(args => args[0] === 'error');
    assert.ok(call);
    return call[1];
  }

  it('stops the strategy, cancels open orders, and alerts the user', async () => {
    const dispatcher = new PlatformDispatcher(new Map());
    const sendToAccount = vi.spyOn(dispatcher, 'sendToAccount').mockResolvedValue(true);
    const monitor = new StrategyMonitor(dispatcher);
    await monitor.subscribeToStrategy(createStrategyRow());

    const error = new OrderSizeBelowMinimumError({
      amountIn: 'base',
      minimumSize: '0.000000001',
      side: OrderSide.SELL,
      size: '0',
    });
    getSessionErrorHandler()(error);

    await vi.waitFor(() => expect(sendToAccount).toHaveBeenCalledTimes(1));
    expect(mockSession.stop).toHaveBeenCalledWith({cancelOpenOrders: true});
    // The persisted row is kept so the user can fix the cause and restart.
    expect(mockStrategyModel.destroy).not.toHaveBeenCalled();
    // The user is alerted on their account, and the typed error is forwarded intact.
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({err: expect.any(OrderSizeBelowMinimumError)}),
      STRATEGY_ERROR_LOG_MESSAGE
    );
  });

  it('tears the session down only once when the error repeats', async () => {
    const dispatcher = new PlatformDispatcher(new Map());
    const sendToAccount = vi.spyOn(dispatcher, 'sendToAccount').mockResolvedValue(true);
    const monitor = new StrategyMonitor(dispatcher);
    await monitor.subscribeToStrategy(createStrategyRow());

    const onError = getSessionErrorHandler();
    onError(new Error('boom'));
    onError(new Error('boom again'));

    await vi.waitFor(() => expect(sendToAccount).toHaveBeenCalledTimes(1));
    expect(mockSession.stop).toHaveBeenCalledTimes(1);
  });
});
