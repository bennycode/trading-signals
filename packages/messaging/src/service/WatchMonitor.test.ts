import {describe, it, expect, vi, beforeEach} from 'vitest';
import type {getBrokerClient, TradingPair} from '@typedtrader/exchange';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import type {Account} from '../database/models/Account.js';
import type {Watch, WatchAttributes} from '../database/models/Watch.js';

const {mockAccountModel, mockExchange, mockWatchModel} = vi.hoisted(() => ({
  mockAccountModel: {findByPk: vi.fn()},
  mockExchange: {
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    unwatchCandles: vi.fn(),
    watchCandles: vi.fn(),
  },
  mockWatchModel: {
    destroy: vi.fn(),
    findAllOrderedById: vi.fn(() => []),
    findByAccountIds: vi.fn(),
    findByPk: vi.fn(),
  },
}));

vi.mock(import('@typedtrader/exchange'), () => ({
  getBrokerClient: vi.fn(() => mockExchange) as unknown as typeof getBrokerClient,
  TradingPair: {fromString: vi.fn(() => ({base: 'BTC', counter: 'USD'}))} as unknown as typeof TradingPair,
}));

vi.mock(import('../database/models/Account.js'), () => ({
  Account: mockAccountModel as unknown as typeof Account,
}));

vi.mock(import('../database/models/Watch.js'), () => ({
  Watch: mockWatchModel as unknown as typeof Watch,
}));

const {WatchMonitor} = await import('./WatchMonitor.js');
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

function createWatchRow(overrides: Partial<WatchAttributes> = {}): WatchAttributes {
  return {
    accountId: 7,
    alertPrice: '50000',
    baselinePrice: '49000',
    createdAt: '2026-05-14T00:00:00.000Z',
    id: 1,
    intervalMs: 60_000,
    pair: 'BTC,USD',
    thresholdDirection: 'up',
    thresholdType: 'percent',
    thresholdValue: '2',
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
      apiKey: 'key',
      apiSecret: 'secret',
      exchange: 'alpaca',
      isPaper: true,
    });
  });

  it('tears down and recreates an active subscription from a freshly loaded row', async () => {
    const monitor = new WatchMonitor(new PlatformDispatcher(new Map()));
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
    const monitor = new WatchMonitor(new PlatformDispatcher(new Map()));
    mockWatchModel.findByAccountIds.mockReturnValue([createWatchRow({id: 99})]);

    await monitor.restartForAccount(7);

    expect(mockExchange.unwatchCandles).not.toHaveBeenCalled();
    expect(mockWatchModel.findByPk).not.toHaveBeenCalled();
  });
});
