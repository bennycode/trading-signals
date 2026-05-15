import {describe, it, expect, vi, beforeEach} from 'vitest';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import type {WatchAttributes} from '../database/models/Watch.js';

const {mockExchange, mockAccountModel, mockWatchModel} = vi.hoisted(() => ({
  mockExchange: {
    watchCandles: vi.fn(),
    on: vi.fn(),
    unwatchCandles: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  mockAccountModel: {findByPk: vi.fn()},
  mockWatchModel: {
    findByAccountIds: vi.fn(),
    findByPk: vi.fn(),
    findAllOrderedById: vi.fn(() => []),
    destroy: vi.fn(),
  },
}));

vi.mock('@typedtrader/exchange', () => ({
  TradingPair: {fromString: vi.fn(() => ({base: 'BTC', counter: 'USD'}))},
  getBrokerClient: vi.fn(() => mockExchange),
}));

vi.mock('../database/models/Account.js', () => ({
  Account: mockAccountModel,
}));

vi.mock('../database/models/Watch.js', () => ({
  Watch: mockWatchModel,
}));

const {WatchMonitor} = await import('./WatchMonitor.js');

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

function createWatchRow(overrides: Partial<WatchAttributes> = {}): WatchAttributes {
  return {
    id: 1,
    accountId: 7,
    pair: 'BTC,USD',
    intervalMs: 60_000,
    alertPrice: '50000',
    baselinePrice: '49000',
    thresholdDirection: 'up',
    thresholdType: 'percent',
    thresholdValue: '2',
    createdAt: '2026-05-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('WatchMonitor platform routing', () => {
  it('resolves the correct platform from a telegram: userId prefix', () => {
    const mockTelegramPlatform = createMockPlatform();
    const platforms = new Map<string, MessagingPlatform>();
    platforms.set('telegram', mockTelegramPlatform);

    const userId = 'telegram:123456' as const;
    expect(platforms.get(userId.split(':')[0])).toBe(mockTelegramPlatform);
  });

  it('returns undefined for an unknown platform prefix', () => {
    const platforms = new Map<string, MessagingPlatform>();
    platforms.set('telegram', createMockPlatform());

    const userId = 'discord:someuser' as const;
    expect(platforms.get(userId.split(':')[0])).toBeUndefined();
  });
});

describe('WatchMonitor.restartForAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExchange.watchCandles.mockResolvedValue('topic-1');
    mockAccountModel.findByPk.mockReturnValue({
      exchange: 'alpaca',
      apiKey: 'key',
      apiSecret: 'secret',
      isPaper: true,
    });
  });

  it('tears down and recreates an active subscription from a freshly loaded row', async () => {
    const monitor = new WatchMonitor(new Map());
    const row = createWatchRow();
    await monitor.subscribeToWatch(row);
    expect(mockExchange.watchCandles).toHaveBeenCalledTimes(1);

    const freshRow = createWatchRow({alertPrice: '51000'});
    mockWatchModel.findByAccountIds.mockReturnValue([row]);
    mockWatchModel.findByPk.mockReturnValue(freshRow);

    await monitor.restartForAccount(7);

    expect(mockExchange.unwatchCandles).toHaveBeenCalledWith('topic-1');
    expect(mockWatchModel.findByPk).toHaveBeenCalledWith(1);
    // Re-subscribe issues a second watchCandles call for the reloaded row.
    expect(mockExchange.watchCandles).toHaveBeenCalledTimes(2);
  });

  it('skips watches that have no active subscription', async () => {
    const monitor = new WatchMonitor(new Map());
    mockWatchModel.findByAccountIds.mockReturnValue([createWatchRow({id: 99})]);

    await monitor.restartForAccount(7);

    expect(mockExchange.unwatchCandles).not.toHaveBeenCalled();
    expect(mockWatchModel.findByPk).not.toHaveBeenCalled();
  });
});
