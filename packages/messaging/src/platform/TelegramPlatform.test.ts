import {describe, it, expect, vi, beforeEach} from 'vitest';
import {TelegramPlatform} from './TelegramPlatform.js';

const mockSendMessage = vi.fn();
const mockGetMe = vi.fn().mockResolvedValue({username: 'testbot'});
const mockLaunch = vi.fn().mockResolvedValue(undefined);
const mockStop = vi.fn();
const mockCommand = vi.fn();

vi.mock('marked', () => ({
  marked: {
    parse: vi.fn((text: string) => Promise.resolve(`<p>${text}</p>`)),
    parseInline: vi.fn((text: string) => Promise.resolve(text)),
  },
}));

vi.mock('telegraf', () => {
  function Telegraf() {
    return {
      command: mockCommand,
      launch: mockLaunch,
      stop: mockStop,
      telegram: {
        sendMessage: mockSendMessage,
        getMe: mockGetMe,
      },
    };
  }

  return {Telegraf};
});

describe('TelegramPlatform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue(undefined);
  });

  describe('commandList', () => {
    it('returns registered commands with / prefix', () => {
      const platform = new TelegramPlatform('bot-token');

      const handler = vi.fn();

      platform.registerCommand('help', handler);
      platform.registerCommand('price', handler);

      expect(platform.commandList).toEqual(['/help', '/price']);
    });

    it('returns empty array when no commands are registered', () => {
      const platform = new TelegramPlatform('bot-token');

      expect(platform.commandList).toEqual([]);
    });
  });

  describe('registerCommand', () => {
    it('stores the command handler and registers it with the bot', () => {
      const platform = new TelegramPlatform('bot-token');

      const handler = vi.fn();

      platform.registerCommand('help', handler);

      expect(platform.commandList).toContain('/help');
      expect(mockCommand).toHaveBeenCalledWith(['help'], expect.any(Function));
    });
  });

  describe('sendMessage', () => {
    it('strips the telegram: prefix and passes the numeric ID to Telegraf', async () => {
      const platform = new TelegramPlatform('bot-token');

      await platform.sendMessage('telegram:123456', 'Hello!');

      expect(mockSendMessage).toHaveBeenCalledWith('123456', expect.any(String), {parse_mode: 'HTML'});
    });

    it('passes the raw chat ID when no prefix is present', async () => {
      const platform = new TelegramPlatform('bot-token');

      await platform.sendMessage('789', 'Hello!');

      expect(mockSendMessage).toHaveBeenCalledWith('789', expect.any(String), {parse_mode: 'HTML'});
    });
  });

  describe('start', () => {
    it('populates platformInfo before launching the bot', async () => {
      const platform = new TelegramPlatform('bot-token');

      const callOrder: string[] = [];
      mockGetMe.mockImplementation(async () => {
        callOrder.push('getMe');
        return {username: 'testbot'};
      });
      mockLaunch.mockImplementation(async () => {
        callOrder.push('launch');
      });

      await platform.start();

      expect(callOrder).toEqual(['getMe', 'launch']);
      expect(platform.platformInfo).toEqual({
        botAddress: '@testbot',
        sdkVersion: 'Telegraf',
      });
    });
  });

  describe('auth middleware', () => {
    it('blocks unauthorized senders when ownerIds is set', async () => {
      const platform = new TelegramPlatform('bot-token', '111,222');

      const handler = vi.fn();

      platform.registerCommand('help', handler);

      // Retrieve the Telegraf command callback registered during registerCommand
      const registeredCallback = mockCommand.mock.calls[0][1];

      const ctxUnauthorized = {
        from: {id: 999},
        message: {text: '/help'},
        reply: vi.fn(),
      };

      await registeredCallback(ctxUnauthorized);

      expect(handler).not.toHaveBeenCalled();
    });

    it('allows authorized senders when ownerIds is set', async () => {
      const platform = new TelegramPlatform('bot-token', '111,222');

      const handler = vi.fn().mockResolvedValue(undefined);

      platform.registerCommand('help', handler);

      const registeredCallback = mockCommand.mock.calls[0][1];

      const ctxAuthorized = {
        from: {id: 111},
        message: {text: '/help'},
        reply: vi.fn(),
      };

      await registeredCallback(ctxAuthorized);

      expect(handler).toHaveBeenCalledOnce();
    });

    it('allows all senders when ownerIds is not set', async () => {
      const platform = new TelegramPlatform('bot-token');

      const handler = vi.fn().mockResolvedValue(undefined);

      platform.registerCommand('help', handler);

      const registeredCallback = mockCommand.mock.calls[0][1];

      const ctxAnySender = {
        from: {id: 999},
        message: {text: '/help'},
        reply: vi.fn(),
      };

      await registeredCallback(ctxAnySender);

      expect(handler).toHaveBeenCalledOnce();
    });

    it('replies when sender ID cannot be determined', async () => {
      const platform = new TelegramPlatform('bot-token');

      const handler = vi.fn();

      platform.registerCommand('help', handler);

      const registeredCallback = mockCommand.mock.calls[0][1];

      const ctxNoFrom = {
        from: undefined,
        message: {text: '/help'},
        reply: vi.fn().mockResolvedValue(undefined),
      };

      await registeredCallback(ctxNoFrom);

      expect(ctxNoFrom.reply).toHaveBeenCalledWith('Unable to determine sender');
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
