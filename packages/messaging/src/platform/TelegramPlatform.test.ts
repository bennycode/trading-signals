import {describe, it, expect, vi, beforeEach} from 'vitest';
import {TelegramPlatform} from './TelegramPlatform.js';

const mockSendMessage = vi.fn();
const mockInit = vi.fn();
const mockStart = vi.fn().mockReturnValue(new Promise(() => {}));
const mockStop = vi.fn();
const mockCommand = vi.fn();
const mockCallbackQuery = vi.fn();
const mockUse = vi.fn();
const botInfo = {username: 'testbot'};

vi.mock('trading-strategies', () => ({
  MESSAGE_BREAK: '\f',
  getAvailableReportNames: vi.fn().mockReturnValue([]),
}));

vi.mock('../command/report/reportAdd.js', () => ({
  reportAdd: vi.fn(),
}));

vi.mock('@grammyjs/conversations', () => ({
  conversations: vi.fn(() => 'conversations-middleware'),
  createConversation: vi.fn(() => 'create-conversation-middleware'),
}));

vi.mock('grammy', () => {
  function Bot() {
    return {
      command: mockCommand,
      callbackQuery: mockCallbackQuery,
      use: mockUse,
      init: mockInit,
      start: mockStart,
      stop: mockStop,
      api: {
        sendMessage: mockSendMessage,
      },
      get botInfo() {
        return botInfo;
      },
    };
  }

  return {Bot};
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

      expect(platform.commandList).toContain('/help');
      expect(platform.commandList).toContain('/price');
    });

    it('includes reportadd when registered', () => {
      const platform = new TelegramPlatform('bot-token');

      platform.registerCommand('reportadd', vi.fn());

      expect(platform.commandList).toContain('/reportadd');
    });

    it('includes the self-registered trade commands even before registerCommand is called', () => {
      const platform = new TelegramPlatform('bot-token');

      // Trade commands register themselves in the TelegramPlatform constructor
      // because their wizards depend on grammy + the conversations plugin.
      expect(platform.commandList).toEqual(
        expect.arrayContaining(['/buymarket', '/sellmarket', '/buylimit', '/selllimit'])
      );
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

      // reportadd uses bot.command and bot.callbackQuery, not the generic handler path
      expect(mockCommand).toHaveBeenCalledWith('reportadd', expect.any(Function));
      expect(mockCallbackQuery).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
    });
  });

  describe('sendMessage', () => {
    it('strips the telegram: prefix and sends as HTML', async () => {
      const platform = new TelegramPlatform('bot-token');

      await platform.sendMessage('telegram:123456', 'Hello!');

      expect(mockSendMessage).toHaveBeenCalledWith('123456', 'Hello!', {parse_mode: 'HTML'});
    });

    it('converts **bold** markdown to <b> HTML tags', async () => {
      const platform = new TelegramPlatform('bot-token');

      await platform.sendMessage('telegram:123456', '**Report:** 5 items');

      expect(mockSendMessage).toHaveBeenCalledWith('123456', '<b>Report:</b> 5 items', {parse_mode: 'HTML'});
    });

    it('falls back to plain text when HTML parsing fails', async () => {
      const platform = new TelegramPlatform('bot-token');

      mockSendMessage.mockRejectedValueOnce(new Error('Bad Request: can\'t parse entities'));

      await platform.sendMessage('telegram:123456', 'Hello world');

      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, '123456', 'Hello world', {parse_mode: 'HTML'});
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, '123456', 'Hello world');
    });

    it('passes the raw chat ID when no prefix is present', async () => {
      const platform = new TelegramPlatform('bot-token');

      await platform.sendMessage('789', 'Hello!');

      expect(mockSendMessage).toHaveBeenCalledWith('789', 'Hello!', {parse_mode: 'HTML'});
    });
  });

  describe('start', () => {
    it('initializes the bot and populates platformInfo before starting polling', async () => {
      const platform = new TelegramPlatform('bot-token');

      const callOrder: string[] = [];
      mockInit.mockImplementation(async () => {
        callOrder.push('init');
      });
      mockStart.mockImplementationOnce(() => {
        callOrder.push('start');
        return new Promise(() => {});
      });

      await platform.start();

      expect(callOrder).toEqual(['init', 'start']);
      expect(mockStart).toHaveBeenCalledWith({drop_pending_updates: true});
      expect(platform.platformInfo).toEqual({
        botAddress: '@testbot',
        sdkVersion: 'grammY',
      });
    });
  });

  describe('auth middleware', () => {
    // `bot.command(name, handler)` is called both by the constructor (for
    // self-registered trade commands) and by each `registerCommand` call, so
    // `mockCommand.mock.calls[0]` is no longer the command under test.
    // Look up the callback by matching the first argument instead.
    const findRegisteredCallback = (commandName: string) => {
      const call = mockCommand.mock.calls.find(([names]) => {
        if (Array.isArray(names)) return names.includes(commandName);
        return names === commandName;
      });
      if (!call) throw new Error(`bot.command was never called with "${commandName}"`);
      return call[1];
    };

    it('blocks unauthorized senders when ownerIds is set', async () => {
      const platform = new TelegramPlatform('bot-token', '111,222');

      const handler = vi.fn();

      platform.registerCommand('help', handler);

      const registeredCallback = findRegisteredCallback('help');

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

      const registeredCallback = findRegisteredCallback('help');

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

      const registeredCallback = findRegisteredCallback('help');

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

      const registeredCallback = findRegisteredCallback('help');

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
