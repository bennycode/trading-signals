import {describe, it, expect, vi, beforeEach} from 'vitest';
import type {Context} from 'grammy';
import {TelegramPlatform, lowercaseCommandMiddleware} from './TelegramPlatform.js';
import {reportAdd} from '../command/report/reportAdd.js';

const mockSendMessage = vi.fn();
const mockInit = vi.fn();
const mockStart = vi.fn().mockReturnValue(new Promise(() => {}));
const mockStop = vi.fn();
const mockCommand = vi.fn();
const mockCallbackQuery = vi.fn();
const mockUse = vi.fn();
const botInfo = {username: 'testbot'};
const mockedReportAdd = vi.mocked(reportAdd);

vi.mock('trading-strategies', () => ({
  MESSAGE_BREAK: '\f',
  getAvailableReportNames: vi.fn().mockReturnValue([]),
}));

vi.mock('../command/report/reportAdd.js', () => ({
  reportAdd: vi.fn(),
}));

const mockFindByUserId = vi.fn().mockReturnValue([]);
const mockFindByUserIdAndId = vi.fn().mockReturnValue(undefined);
vi.mock('../database/models/Account.js', () => ({
  Account: {
    findByUserId: (...args: unknown[]) => mockFindByUserId(...args),
    findByUserIdAndId: (...args: unknown[]) => mockFindByUserIdAndId(...args),
  },
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

    it('includes reportAdd when registered', () => {
      const platform = new TelegramPlatform('bot-token');

      platform.registerCommand('reportAdd', vi.fn());

      expect(platform.commandList).toContain('/reportAdd');
    });

    it('includes the self-registered trade commands even before registerCommand is called', () => {
      const platform = new TelegramPlatform('bot-token');

      // Trade commands register themselves in the TelegramPlatform constructor
      // because their wizards depend on grammy + the conversations plugin.
      expect(platform.commandList).toEqual(
        expect.arrayContaining(['/buyMarket', '/sellMarket', '/buyLimit', '/sellLimit'])
      );
    });
  });

  describe('registerCommand', () => {
    const findRegisteredCallbackQuery = (pattern: string) => {
      const call = mockCallbackQuery.mock.calls.find(([regex]) => regex instanceof RegExp && regex.source.includes(pattern));
      if (!call) throw new Error(`bot.callbackQuery was never called with pattern "${pattern}"`);
      return call[1];
    };

    it('stores the command handler and registers it with the bot', () => {
      const platform = new TelegramPlatform('bot-token');

      const handler = vi.fn();

      platform.registerCommand('help', handler);

      expect(platform.commandList).toContain('/help');
      expect(mockCommand).toHaveBeenCalledWith(['help'], expect.any(Function));
    });

    it('registers reportAdd with inline keyboard buttons instead of regular command', () => {
      const platform = new TelegramPlatform('bot-token');

      platform.registerCommand('reportAdd', vi.fn());

      // reportAdd uses bot.command and bot.callbackQuery, not the generic handler path.
      // grammY only accepts lowercase command names, so the registration uses 'reportadd'
      // while the display name stays camelCase.
      expect(mockCommand).toHaveBeenCalledWith('reportadd', expect.any(Function));
      expect(mockCallbackQuery).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
    });

    it('handles malformed schedule interval callback payloads without throwing', async () => {
      const platform = new TelegramPlatform('bot-token', '123');

      const {getAvailableReportNames} = await import('trading-strategies');
      vi.mocked(getAvailableReportNames).mockReturnValue(['rsi']);

      platform.registerCommand('reportAdd', vi.fn());

      const callback = findRegisteredCallbackQuery('reportinterval');
      const ctx = {
        answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
        editMessageText: vi.fn().mockResolvedValue(undefined),
        from: {id: 123},
        match: ['', 'not-an-interval', 'rsi'],
      };

      await callback(ctx as never);

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        'Invalid interval "not-an-interval". Please select one of: 1m, 1h, 6h, 12h, 1d, 1w.'
      );
      expect(mockedReportAdd).not.toHaveBeenCalled();
    });

    describe('report wizard callback auth', () => {
      const buildCtx = (senderId: number, match: string[]) => ({
        answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
        editMessageText: vi.fn().mockResolvedValue(undefined),
        from: {id: senderId},
        match,
      });

      it('drops the report-pick callback when the sender is not an owner', async () => {
        const platform = new TelegramPlatform('bot-token', '111');
        platform.registerCommand('reportAdd', vi.fn());

        const callback = findRegisteredCallbackQuery('report:');
        const ctx = buildCtx(999, ['', 'rsi']);

        await callback(ctx as never);

        expect(ctx.editMessageText).not.toHaveBeenCalled();
        expect(mockFindByUserId).not.toHaveBeenCalled();
      });

      it('drops the account-pick callback when the sender is not an owner', async () => {
        const platform = new TelegramPlatform('bot-token', '111');
        platform.registerCommand('reportAdd', vi.fn());

        const callback = findRegisteredCallbackQuery('reportaccount:');
        const ctx = buildCtx(999, ['', '42', 'rsi']);

        await callback(ctx as never);

        expect(ctx.editMessageText).not.toHaveBeenCalled();
        expect(mockFindByUserIdAndId).not.toHaveBeenCalled();
      });

      it('drops the run-once callback when the sender is not an owner', async () => {
        const platform = new TelegramPlatform('bot-token', '111');
        platform.registerCommand('reportAdd', vi.fn());

        const callback = findRegisteredCallbackQuery('reportmode:');
        const ctx = buildCtx(999, ['', 'rsi']);

        await callback(ctx as never);

        expect(mockedReportAdd).not.toHaveBeenCalled();
      });

      it('rejects report names not in the whitelist', async () => {
        const platform = new TelegramPlatform('bot-token', '111');
        const {getAvailableReportNames} = await import('trading-strategies');
        vi.mocked(getAvailableReportNames).mockReturnValue(['rsi']);

        platform.registerCommand('reportAdd', vi.fn());

        const callback = findRegisteredCallbackQuery('report:');
        const ctx = buildCtx(111, ['', '../../etc/passwd']);

        await callback(ctx as never);

        expect(ctx.editMessageText).toHaveBeenCalledWith('Unknown report "../../etc/passwd".');
        expect(mockFindByUserId).not.toHaveBeenCalled();
      });

      it('rejects account IDs that do not belong to the sender', async () => {
        const platform = new TelegramPlatform('bot-token', '111');
        const {getAvailableReportNames} = await import('trading-strategies');
        vi.mocked(getAvailableReportNames).mockReturnValue(['rsi']);
        // Sender 111 → no account 42 for them.
        mockFindByUserIdAndId.mockReturnValue(undefined);

        platform.registerCommand('reportAdd', vi.fn());

        const callback = findRegisteredCallbackQuery('reportaccount:');
        const ctx = buildCtx(111, ['', '42', 'rsi']);

        await callback(ctx as never);

        expect(mockFindByUserIdAndId).toHaveBeenCalledWith('telegram:111', 42);
        expect(ctx.editMessageText).toHaveBeenCalledWith('Account not found.');
      });

      it('rejects run-once payloads that carry an unknown report name', async () => {
        const platform = new TelegramPlatform('bot-token', '111');
        const {getAvailableReportNames} = await import('trading-strategies');
        vi.mocked(getAvailableReportNames).mockReturnValue(['rsi']);

        platform.registerCommand('reportAdd', vi.fn());

        const callback = findRegisteredCallbackQuery('reportmode:');
        const ctx = buildCtx(111, ['', 'bogus-report']);

        await callback(ctx as never);

        expect(ctx.editMessageText).toHaveBeenCalledWith('Unknown report "bogus-report".');
        expect(mockedReportAdd).not.toHaveBeenCalled();
      });

      it('rejects run-once payloads that carry an account not owned by the sender', async () => {
        const platform = new TelegramPlatform('bot-token', '111');
        const {getAvailableReportNames} = await import('trading-strategies');
        vi.mocked(getAvailableReportNames).mockReturnValue(['rsi']);
        mockFindByUserIdAndId.mockReturnValue(undefined);

        platform.registerCommand('reportAdd', vi.fn());

        const callback = findRegisteredCallbackQuery('reportmode:');
        const ctx = buildCtx(111, ['', 'rsi 999']);

        await callback(ctx as never);

        expect(mockFindByUserIdAndId).toHaveBeenCalledWith('telegram:111', 999);
        expect(ctx.editMessageText).toHaveBeenCalledWith('Account not found.');
        expect(mockedReportAdd).not.toHaveBeenCalled();
      });
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
      const platform = new TelegramPlatform('bot-token', '111');

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

    it('starts in open mode with an empty owner list and warns about it', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const platform = new TelegramPlatform('bot-token');

      await platform.start();

      expect(mockInit).toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalledWith({drop_pending_updates: true});
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TELEGRAM_OWNER_IDS is unset or empty'));
      warnSpy.mockRestore();
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

    it('accepts every sender when ownerIds is not set (open mode)', async () => {
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

    it.each([' ', ',', ' , , '])(
      'collapses whitespace/comma-only ownerIds (%j) to open mode instead of rejecting every sender',
      async ownerIds => {
        const platform = new TelegramPlatform('bot-token', ownerIds);

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
      }
    );

    it('silently drops updates with no sender', async () => {
      const platform = new TelegramPlatform('bot-token', '111');

      const handler = vi.fn();

      platform.registerCommand('help', handler);

      const registeredCallback = findRegisteredCallback('help');

      const ctxNoFrom = {
        from: undefined,
        message: {text: '/help'},
        reply: vi.fn().mockResolvedValue(undefined),
      };

      await registeredCallback(ctxNoFrom);

      expect(handler).not.toHaveBeenCalled();
      expect(ctxNoFrom.reply).not.toHaveBeenCalled();
    });
  });

  describe('lowercaseCommandMiddleware', () => {
    function buildCtx(text: string): Context {
      return {
        message: {
          text,
          entities: [{type: 'bot_command', offset: 0, length: text.split(' ')[0].length}],
        },
      } as unknown as Context;
    }

    it('lowercases a mixed-case command', async () => {
      const ctx = buildCtx('/ReportAdd');
      await lowercaseCommandMiddleware(ctx, async () => {});
      expect(ctx.message?.text).toBe('/reportadd');
    });

    it('lowercases an all-caps command', async () => {
      const ctx = buildCtx('/REPORTADD');
      await lowercaseCommandMiddleware(ctx, async () => {});
      expect(ctx.message?.text).toBe('/reportadd');
    });

    it('lowercases a chaotic casing', async () => {
      const ctx = buildCtx('/repOrTADd');
      await lowercaseCommandMiddleware(ctx, async () => {});
      expect(ctx.message?.text).toBe('/reportadd');
    });

    it('preserves the @botname suffix verbatim', async () => {
      const ctx = buildCtx('/ReportAdd@MyBot');
      await lowercaseCommandMiddleware(ctx, async () => {});
      expect(ctx.message?.text).toBe('/reportadd@MyBot');
    });

    it('preserves arguments after the command', async () => {
      const ctx = buildCtx('/BuyMarket AAPL,USD 100');
      await lowercaseCommandMiddleware(ctx, async () => {});
      expect(ctx.message?.text).toBe('/buymarket AAPL,USD 100');
    });

    it('is a no-op when no bot_command entity is present', async () => {
      const ctx = {message: {text: 'hello world', entities: []}} as unknown as Context;
      await lowercaseCommandMiddleware(ctx, async () => {});
      expect(ctx.message?.text).toBe('hello world');
    });

    it('calls next exactly once', async () => {
      const ctx = buildCtx('/help');
      const next = vi.fn().mockResolvedValue(undefined);
      await lowercaseCommandMiddleware(ctx, next);
      expect(next).toHaveBeenCalledOnce();
    });
  });
});
