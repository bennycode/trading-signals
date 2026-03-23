import {describe, it, expect, vi} from 'vitest';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';

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

describe('WatchMonitor platform routing', () => {
  it('resolves the correct platform from a telegram: userId prefix', () => {
    const mockTelegramPlatform = createMockPlatform();

    const platforms = new Map<string, MessagingPlatform>();

    platforms.set('telegram', mockTelegramPlatform);

    const userId = 'telegram:123456' as const;
    const prefix = userId.split(':')[0];

    expect(platforms.get(prefix)).toBe(mockTelegramPlatform);
  });

  it('returns undefined for an unknown platform prefix', () => {
    const mockTelegramPlatform = createMockPlatform();

    const platforms = new Map<string, MessagingPlatform>();

    platforms.set('telegram', mockTelegramPlatform);

    const userId = 'discord:someuser' as const;
    const prefix = userId.split(':')[0];

    expect(platforms.get(prefix)).toBeUndefined();
  });
});
