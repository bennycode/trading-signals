import {describe, it, expect, vi, beforeEach} from 'vitest';
import {TelegramPlatform} from './TelegramPlatform.js';

const mockSendMessage = vi.fn();
const mockGetMe = vi.fn().mockResolvedValue({username: 'testbot'});
const mockLaunch = vi.fn().mockResolvedValue(undefined);
const mockStop = vi.fn();
const mockCommand = vi.fn();
const mockAction = vi.fn();

vi.mock('trading-strategies', () => ({
  getAvailableReportNames: vi.fn().mockReturnValue([]),
}));

vi.mock('../command/report/reportAdd.js', () => ({
  reportAdd: vi.fn(),
}));

vi.mock('telegraf', () => {
  function Telegraf() {
    return {
      command: mockCommand,
      action: mockAction,
      launch: mockLaunch,
      stop: mockStop,
      telegram: {
        sendMessage: mockSendMessage,
        getMe: mockGetMe,
      },
    };
  }

  return {
    Telegraf,
    Markup: {
      inlineKeyboard: vi.fn().mockReturnValue({}),
      button: {
        callback: vi.fn().mockReturnValue({}),
      },
    },
  };
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

    it('includes reportadd when registered', () => {
      const platform = new TelegramPlatform('bot-token');

      platform.registerCommand('reportadd', vi.fn());

      expect(platform.commandList).toContain('/reportadd');
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

    it('registers reportadd with inline keyboard buttons instead of regular command', () => {
      const platform = new TelegramPlatform('bot-token');

      platform.registerCommand('reportadd', vi.fn());

      // reportadd uses bot.command and bot.action, not the generic handler path
      expect(mockCommand).toHaveBeenCalledWith('reportadd', expect.any(Function));
      expect(mockAction).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
    });
  });

  describe('sendMessage', () => {
    it('strips the telegram: prefix and sends with MarkdownV2', async () => {
      const platform = new TelegramPlatform('bot-token');

      await platform.sendMessage('telegram:123456', 'Hello!');

      expect(mockSendMessage).toHaveBeenCalledWith('123456', 'Hello!', {parse_mode: 'MarkdownV2'});
    });

    it('falls back to plain text when MarkdownV2 fails', async () => {
      const platform = new TelegramPlatform('bot-token');

      mockSendMessage.mockRejectedValueOnce(new Error('Bad Request: can\'t parse entities'));

      await platform.sendMessage('telegram:123456', 'Hello <world>!');

      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, '123456', 'Hello <world>!', {parse_mode: 'MarkdownV2'});
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, '123456', 'Hello <world>!');
    });

    it('passes the raw chat ID when no prefix is present', async () => {
      const platform = new TelegramPlatform('bot-token');

      await platform.sendMessage('789', 'Hello!');

      expect(mockSendMessage).toHaveBeenCalledWith('789', 'Hello!', {parse_mode: 'MarkdownV2'});
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
