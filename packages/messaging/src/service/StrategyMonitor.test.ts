import {describe, it, expect, vi} from 'vitest';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import {formatStrategyMessage} from './StrategyMonitor.js';

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
