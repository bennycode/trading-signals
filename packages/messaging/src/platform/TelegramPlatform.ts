import {Bot} from 'grammy';
import type {Context} from 'grammy';
import {autoRetry} from '@grammyjs/auto-retry';
import {conversations, createConversation} from '@grammyjs/conversations';
import type {CommandHandler, MessageContext, MessagingPlatform, PlatformInfo} from './MessagingPlatform.js';
import {markdownToTelegramHtml, replyWithMarkdown, splitForTelegram} from './telegramMarkdown.js';
import {registerReportAddFlow} from './reportAddFlow.js';
import {lowercaseCommandMiddleware} from './lowercaseCommandMiddleware.js';
import type {ReportScheduler, StrategyMonitor, WatchMonitor} from '../service/index.js';
import {logger} from '../logger.js';
import {
  ACCOUNT_ADD_WIZARD_ID,
  ACCOUNT_EDIT_WIZARD_ID,
  STRATEGY_ADD_WIZARD_ID,
  WATCH_ADD_WIZARD_ID,
  type WizardContext,
} from './wizards/shared.js';
import {makeAccountAddWizard} from './wizards/accountAddWizard.js';
import {makeAccountEditWizard} from './wizards/accountEditWizard.js';
import {makeWatchAddWizard} from './wizards/watchAddWizard.js';
import {makeStrategyAddWizard} from './wizards/strategyAddWizard.js';
import {
  TRADE_COMMAND_NAMES,
  TRADE_WIZARD_ID,
  parseTradeCommandInput,
  tradeWizard,
  type TradeCommandName,
} from './wizards/tradeWizard.js';

const PLATFORM_PREFIX = 'telegram:';

const WIZARD_COMMANDS = new Map([
  ['accountadd', ACCOUNT_ADD_WIZARD_ID],
  ['accountedit', ACCOUNT_EDIT_WIZARD_ID],
  ['watchadd', WATCH_ADD_WIZARD_ID],
  ['strategyadd', STRATEGY_ADD_WIZARD_ID],
]);

export class TelegramPlatform implements MessagingPlatform {
  readonly #bot: Bot<WizardContext>;
  readonly #ownerIds: string[];
  readonly #commands: Map<string, CommandHandler> = new Map();
  #platformInfo: PlatformInfo = {botAddress: '', sdkVersion: ''};
  #reportScheduler?: ReportScheduler;
  #watchMonitor?: WatchMonitor;
  #strategyMonitor?: StrategyMonitor;

  constructor(botToken: string, ownerIds?: string) {
    this.#bot = new Bot<WizardContext>(botToken);

    // @see https://grammy.dev/plugins/auto-retry
    this.#bot.api.config.use(
      autoRetry({
        maxDelaySeconds: 120,
        maxRetryAttempts: Infinity,
      })
    );
    /*
     * Filter out empty entries so whitespace- or comma-only inputs (e.g. " " or ",") collapse to
     * an empty list, which the bot refuses to start with, instead of a list of empty IDs.
     */
    this.#ownerIds = ownerIds
      ? ownerIds
          .split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0)
      : [];

    /*
     * Normalize incoming /Commands to lowercase so grammY's case-sensitive
     * command matching accepts any casing (/reportAdd, /REPORTADD, /repOrTADd).
     * Must run before the command handlers installed below.
     */
    this.#bot.use(lowercaseCommandMiddleware);

    /*
     * Drop unauthorized updates before they reach the conversations plugin or
     * any command / callback handler. This is the global gate — individual
     * handlers still call `#authorizedUserId` to obtain the prefixed userId,
     * but they can trust the middleware has already turned away non-owners.
     */
    this.#bot.use(async (ctx, next) => {
      if (this.#authorizedUserId(ctx) === null) {
        return;
      }
      await next();
    });

    /*
     * Install @grammyjs/conversations plugin BEFORE any command handlers are
     * registered. The `conversations()` middleware must run for every update
     * so it can resume active sessions on subsequent callback_query updates,
     * and `createConversation(...)` has to be visible to the command handler
     * that calls `ctx.conversation.enter(...)`.
     */
    this.#bot.use(conversations());
    /*
     * parallel: true lets non-matching updates fall through to downstream
     * middleware (our command handlers). Without it, typing /watchAdd during
     * an active /accountAdd exchange-picker would be dropped, and the global
     * /cancel command could never fire while any wizard was active.
     */
    this.#bot.use(createConversation(tradeWizard, {id: TRADE_WIZARD_ID, parallel: true}));
    this.#bot.use(createConversation(makeAccountAddWizard(), {id: ACCOUNT_ADD_WIZARD_ID, parallel: true}));
    this.#bot.use(
      createConversation(
        makeAccountEditWizard({
          strategyMonitor: () => this.#strategyMonitor,
          watchMonitor: () => this.#watchMonitor,
        }),
        {id: ACCOUNT_EDIT_WIZARD_ID, parallel: true}
      )
    );
    this.#bot.use(
      createConversation(makeWatchAddWizard({watchMonitor: () => this.#watchMonitor}), {
        id: WATCH_ADD_WIZARD_ID,
        parallel: true,
      })
    );
    this.#bot.use(
      createConversation(makeStrategyAddWizard({strategyMonitor: () => this.#strategyMonitor}), {
        id: STRATEGY_ADD_WIZARD_ID,
        parallel: true,
      })
    );

    /*
     * Trade commands are Telegram-specific: they need inline keyboards and
     * the conversations plugin, so they register themselves directly here
     * instead of going through the cross-platform `registerCommand` interface.
     */
    for (const name of TRADE_COMMAND_NAMES) {
      this.#registerTradeCommand(name);
    }

    /*
     * /cancel fires when no active wait consumes it — i.e. when nothing is
     * active, or when the active wait is callback-only (non-text updates
     * fall through). During a text-wait, each wizard detects /command input
     * internally and cancels itself.
     */
    this.#commands.set('cancel', async () => {});
    this.#bot.command('cancel', async ctx => {
      if (this.#authorizedUserId(ctx) === null) {
        return;
      }
      const active = ctx.conversation.active();
      const names = Object.keys(active);
      if (names.length === 0) {
        await ctx.reply('Nothing to cancel.');
        return;
      }
      for (const name of names) {
        await ctx.conversation.exit(name);
      }
      await ctx.reply('Cancelled.');
    });
  }

  setReportScheduler(scheduler: ReportScheduler): void {
    this.#reportScheduler = scheduler;
  }

  setWatchMonitor(monitor: WatchMonitor): void {
    this.#watchMonitor = monitor;
  }

  setStrategyMonitor(monitor: StrategyMonitor): void {
    this.#strategyMonitor = monitor;
  }

  registerCommand(name: string | string[], handler: CommandHandler): void {
    const names = Array.isArray(name) ? name : [name];
    for (const n of names) {
      this.#commands.set(n, handler);
    }
    const lowerNames = names.map(n => n.toLowerCase());

    // reportadd is handled via inline keyboard buttons
    if (lowerNames.includes('reportadd')) {
      registerReportAddFlow(this.#bot, {
        authorizedUserId: ctx => this.#authorizedUserId(ctx),
        reportScheduler: () => this.#reportScheduler,
      });
      return;
    }

    // account/watch/strategy adds use conversations-based wizards
    for (const [commandName, wizardId] of WIZARD_COMMANDS) {
      if (lowerNames.includes(commandName)) {
        this.#registerWizardCommand(commandName, wizardId);
        return;
      }
    }

    this.#bot.command(lowerNames, async ctx => {
      const userId = this.#authorizedUserId(ctx);
      if (!userId) {
        return;
      }

      // Extract text after the /command
      const text = ctx.message?.text ?? '';
      const commandEnd = text.indexOf(' ');
      const content = commandEnd === -1 ? '' : text.slice(commandEnd + 1);

      const messageCtx: MessageContext = {
        content,
        platformId: 'telegram',
        reply: async (replyText: string) => {
          await replyWithMarkdown(ctx, replyText);
        },
        senderId: userId,
      };

      await handler(messageCtx);
    });
  }

  /**
   * Returns the platform-prefixed userId for an authorized sender, or `null`
   * otherwise. A global middleware installed in the constructor runs this on
   * every inbound update and drops the update when it returns `null`, so by
   * the time a command/callback handler fires the sender is guaranteed to be
   * authorized. Handlers still call this helper to obtain the prefixed userId
   * for downstream queries — the double-check is defense-in-depth against a
   * future handler that bypasses the middleware.
   *
   * The bot is fail-closed: without owner IDs it authorizes nobody. `start()`
   * already refuses to run in that case, so this only guards against a path
   * that handles updates without starting the bot first.
   */
  #authorizedUserId(ctx: Context): string | null {
    const senderId = ctx.from?.id?.toString();
    if (!senderId) {
      return null;
    }
    if (this.#ownerIds.length === 0) {
      return null;
    }
    if (!this.#ownerIds.includes(senderId)) {
      logger.warn({ownerIds: this.#ownerIds, senderId}, 'Ignoring unauthorized Telegram update');
      return null;
    }
    return `${PLATFORM_PREFIX}${senderId}`;
  }

  #registerWizardCommand(commandName: string, conversationId: string): void {
    this.#bot.command(commandName, async ctx => {
      const userId = this.#authorizedUserId(ctx);
      if (!userId) {
        return;
      }
      const activeBefore = Object.keys(ctx.conversation.active());
      logger.info({activeBefore, commandName, conversationId}, 'wizard command invoked');
      try {
        /*
         * Auto-cancel any wizard already in progress for this user. Only
         * reachable when the existing wait was callback-only (non-text falls
         * through to this handler) — text waits consume the new /command
         * text first and cancel themselves via waitForTextOrCancel.
         */
        for (const name of activeBefore) {
          await ctx.conversation.exit(name);
        }
        await ctx.conversation.enter(conversationId, {userId});
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({conversationId, message}, 'wizard entry failed');
        await ctx.reply('Could not start the wizard — please try again in a moment.');
      }
    });
  }

  #registerTradeCommand(name: TradeCommandName): void {
    /*
     * Record the camelCase name so it appears in `/help`. The handler stored
     * here is never invoked directly — the real wizard runs via the
     * `bot.command(...)` handler installed below — but `commandList` reads
     * from `#commands`.
     */
    this.#commands.set(name, async () => {});

    this.#bot.command(name.toLowerCase(), async ctx => {
      const userId = this.#authorizedUserId(ctx);
      if (!userId) {
        return;
      }

      const args = await parseTradeCommandInput(ctx, name);
      if (!args) {
        return;
      } // parseTradeCommandInput already replied with the usage error

      await ctx.conversation.enter(TRADE_WIZARD_ID, {...args, userId});
    });
  }

  async start(): Promise<void> {
    /*
     * Anyone who finds the bot could otherwise drive the trading wizards against the configured
     * broker accounts, so a missing owner list stops the bot instead of opening it to everyone.
     */
    if (this.#ownerIds.length === 0) {
      throw new Error(
        'TELEGRAM_OWNER_IDS is unset or empty. Set it to a comma-separated list of Telegram user IDs; the bot refuses to start without one.'
      );
    }
    /*
     * Telegram user IDs are positive integers of at most 52 bits, compared as decimal strings.
     * Anything else (a username, a typo like "111;222", "1e3") can never match a sender, so the
     * bot would start and silently reject its own owner.
     */
    const isUserId = (id: string) => /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
    const invalidIds = this.#ownerIds.filter(id => !isUserId(id));
    if (invalidIds.length > 0) {
      throw new Error(
        `TELEGRAM_OWNER_IDS contains ${invalidIds.map(id => `"${id}"`).join(', ')}, which is not a numeric Telegram user ID. Look up yours via @userinfobot.`
      );
    }
    logger.info({ownerIds: this.#ownerIds}, 'Telegram bot owner restriction active');

    await this.#bot.init();
    this.#platformInfo = {
      botAddress: `@${this.#bot.botInfo.username}`,
      sdkVersion: 'grammY',
    };

    /*
     * bot.start() resolves only when the bot is stopped, so we don't await it —
     * we want start() to return to the caller once polling is running.
     */
    this.#bot.start({drop_pending_updates: true}).catch((err: unknown) => {
      logger.error({err}, 'Telegram bot polling error');
    });

    logger.info({botAddress: this.#platformInfo.botAddress}, 'Telegram bot started');
  }

  async stop(): Promise<void> {
    await this.#bot.stop();
  }

  async sendMessage(userId: string, text: string): Promise<void> {
    const chatId = userId.replace(PLATFORM_PREFIX, '');
    for (const chunk of splitForTelegram(text)) {
      /*
       * If our markdown→HTML converter throws (bug in the converter, malformed
       * input we didn't anticipate), fall back to plaintext so the user still
       * receives the message. API-side failures (transport, Telegram parse
       * rejection, rate limit) are NOT caught here — `@grammyjs/auto-retry`
       * handles transients at the API layer, anything it can't recover from
       * propagates to the caller.
       */
      let html: string;
      try {
        html = markdownToTelegramHtml(chunk);
      } catch (error) {
        logger.warn({err: error}, 'Markdown-to-HTML render failed, sending plaintext...');
        await this.#bot.api.sendMessage(chatId, chunk);
        continue;
      }

      await this.#bot.api.sendMessage(chatId, html, {parse_mode: 'HTML'});
    }
  }

  get commandList(): string[] {
    return Array.from(this.#commands.keys()).map(cmd => `/${cmd}`);
  }

  get platformInfo(): PlatformInfo {
    return this.#platformInfo;
  }
}
