import {describe, it, expect, vi, beforeEach} from 'vitest';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';

const mocks = vi.hoisted(() => {
  const mockWatchCandles = vi.fn().mockResolvedValue('topic-abc');
  const mockUnwatchCandles = vi.fn();
  const mockOn = vi.fn();
  const mockRemoveAllListeners = vi.fn();
  const mockExchangeInstance = {
    watchCandles: mockWatchCandles,
    unwatchCandles: mockUnwatchCandles,
    on: mockOn,
    removeAllListeners: mockRemoveAllListeners,
  };

  const mockAccountFindByPk = vi.fn();
  const mockWatchFindAllOrderedById = vi.fn().mockReturnValue([]);
  const mockWatchDestroy = vi.fn();

  return {
    mockWatchCandles,
    mockUnwatchCandles,
    mockOn,
    mockRemoveAllListeners,
    mockExchangeInstance,
    mockAccountFindByPk,
    mockWatchFindAllOrderedById,
    mockWatchDestroy,
  };
});

vi.mock('../database/models/Account.js', () => ({
  Account: {findByPk: mocks.mockAccountFindByPk},
}));

vi.mock('../database/models/Watch.js', () => ({
  Watch: {
    findAllOrderedById: mocks.mockWatchFindAllOrderedById,
    destroy: mocks.mockWatchDestroy,
  },
}));

vi.mock('@typedtrader/exchange', () => ({
  TradingPair: {fromString: vi.fn().mockReturnValue({base: 'BTC', counter: 'USDT'})},
  getExchangeClient: vi.fn().mockReturnValue(mocks.mockExchangeInstance),
}));

import {WatchMonitor, dispatchAlertToUser} from './WatchMonitor.js';

function createMockPlatform(): MessagingPlatform {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    registerCommand: vi.fn(),
    commandList: [],
    platformInfo: {botAddress: '', sdkVersion: ''},
  };
}

const baseWatch = {
  id: 1,
  accountId: 1,
  pair: 'BTC,USDT',
  intervalMs: 60_000,
  thresholdType: 'absolute' as const,
  thresholdDirection: 'up' as const,
  thresholdValue: '5000',
  baselinePrice: '45000',
  alertPrice: '50000',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('dispatchAlertToUser', () => {
  it('calls sendMessage on the matching platform using the full userId', async () => {
    const xmtpPlatform = createMockPlatform();
    const telegramPlatform = createMockPlatform();
    const platforms = new Map<string, MessagingPlatform>([
      ['xmtp', xmtpPlatform],
      ['telegram', telegramPlatform],
    ]);

    await dispatchAlertToUser(platforms, 'xmtp:0xabc123', 1, 'Price Alert!');

    expect(xmtpPlatform.sendMessage).toHaveBeenCalledWith('xmtp:0xabc123', 'Price Alert!');
    expect(telegramPlatform.sendMessage).not.toHaveBeenCalled();
  });

  it('routes a telegram: userId to the telegram platform', async () => {
    const xmtpPlatform = createMockPlatform();
    const telegramPlatform = createMockPlatform();
    const platforms = new Map<string, MessagingPlatform>([
      ['xmtp', xmtpPlatform],
      ['telegram', telegramPlatform],
    ]);

    await dispatchAlertToUser(platforms, 'telegram:123456', 1, 'Price Alert!');

    expect(telegramPlatform.sendMessage).toHaveBeenCalledWith('telegram:123456', 'Price Alert!');
    expect(xmtpPlatform.sendMessage).not.toHaveBeenCalled();
  });

  it('does not call sendMessage when the platform prefix is unknown', async () => {
    const xmtpPlatform = createMockPlatform();
    const platforms = new Map<string, MessagingPlatform>([['xmtp', xmtpPlatform]]);

    await dispatchAlertToUser(platforms, 'discord:someuser', 1, 'Price Alert!');

    expect(xmtpPlatform.sendMessage).not.toHaveBeenCalled();
  });
});

describe('WatchMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockWatchCandles.mockResolvedValue('topic-abc');
    mocks.mockWatchFindAllOrderedById.mockReturnValue([]);
  });

  describe('subscribeToWatch', () => {
    it('calls sendMessage on the correct platform when an alert triggers', async () => {
      const xmtpPlatform = createMockPlatform();
      const telegramPlatform = createMockPlatform();
      const platforms = new Map<string, MessagingPlatform>([
        ['xmtp', xmtpPlatform],
        ['telegram', telegramPlatform],
      ]);

      mocks.mockAccountFindByPk.mockReturnValue({
        id: 1,
        userId: 'xmtp:0xabc123',
        exchange: 'alpaca',
        apiKey: 'key',
        apiSecret: 'secret',
        isPaper: true,
      });

      const monitor = new WatchMonitor(platforms);
      await monitor.subscribeToWatch(baseWatch);

      // Simulate a candle whose close price breaches the alert threshold
      const [, candleListener] = mocks.mockOn.mock.calls[0];
      await candleListener({close: '51000'});

      expect(xmtpPlatform.sendMessage).toHaveBeenCalledOnce();
      expect(xmtpPlatform.sendMessage).toHaveBeenCalledWith('xmtp:0xabc123', expect.stringContaining('Price Alert'));
      expect(telegramPlatform.sendMessage).not.toHaveBeenCalled();
    });

    it('calls sendMessage on the telegram platform when the account has a telegram: userId', async () => {
      const xmtpPlatform = createMockPlatform();
      const telegramPlatform = createMockPlatform();
      const platforms = new Map<string, MessagingPlatform>([
        ['xmtp', xmtpPlatform],
        ['telegram', telegramPlatform],
      ]);

      mocks.mockAccountFindByPk.mockReturnValue({
        id: 1,
        userId: 'telegram:999888',
        exchange: 'alpaca',
        apiKey: 'key',
        apiSecret: 'secret',
        isPaper: true,
      });

      const monitor = new WatchMonitor(platforms);
      await monitor.subscribeToWatch(baseWatch);

      const [, candleListener] = mocks.mockOn.mock.calls[0];
      await candleListener({close: '51000'});

      expect(telegramPlatform.sendMessage).toHaveBeenCalledOnce();
      expect(telegramPlatform.sendMessage).toHaveBeenCalledWith('telegram:999888', expect.stringContaining('Price Alert'));
      expect(xmtpPlatform.sendMessage).not.toHaveBeenCalled();
    });

    it('does not call sendMessage when the candle price has not breached the threshold', async () => {
      const xmtpPlatform = createMockPlatform();
      const platforms = new Map<string, MessagingPlatform>([['xmtp', xmtpPlatform]]);

      mocks.mockAccountFindByPk.mockReturnValue({
        id: 1,
        userId: 'xmtp:0xabc123',
        exchange: 'alpaca',
        apiKey: 'key',
        apiSecret: 'secret',
        isPaper: true,
      });

      const monitor = new WatchMonitor(platforms);
      await monitor.subscribeToWatch(baseWatch);

      const [, candleListener] = mocks.mockOn.mock.calls[0];
      // Price is below the 50000 alert threshold
      await candleListener({close: '49999'});

      expect(xmtpPlatform.sendMessage).not.toHaveBeenCalled();
    });

    it('destroys the watch after the alert is sent', async () => {
      const xmtpPlatform = createMockPlatform();
      const platforms = new Map<string, MessagingPlatform>([['xmtp', xmtpPlatform]]);

      mocks.mockAccountFindByPk.mockReturnValue({
        id: 1,
        userId: 'xmtp:0xabc123',
        exchange: 'alpaca',
        apiKey: 'key',
        apiSecret: 'secret',
        isPaper: true,
      });

      const monitor = new WatchMonitor(platforms);
      await monitor.subscribeToWatch(baseWatch);

      const [, candleListener] = mocks.mockOn.mock.calls[0];
      await candleListener({close: '51000'});

      expect(mocks.mockWatchDestroy).toHaveBeenCalledWith(baseWatch.id);
    });
  });
});

