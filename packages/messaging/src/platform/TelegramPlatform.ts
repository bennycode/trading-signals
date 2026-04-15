import {Bot} from 'grammy';
import type {Context} from 'grammy';
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from '@grammyjs/conversations';
import {z} from 'zod';
import {ExchangeOrderSide, TradingPair, getExchangeClient} from '@typedtrader/exchange';
import {getAvailableReportNames, reportRequiresAccount} from 'trading-strategies';
import type {CommandHandler, MessageContext, MessagingPlatform, PlatformInfo} from './MessagingPlatform.js';
import {markdownToTelegramHtml, splitForTelegram} from './telegramMarkdown.js';
import {placeOrder} from '../command/placeOrder.js';
import {reportAdd} from '../command/report/reportAdd.js';
import {assertInterval} from '../validation/assertInterval.js';
import {Account} from '../database/models/Account.js';
import type {ReportScheduler} from '../service/ReportScheduler.js';

const PLATFORM_PREFIX = 'telegram:';
const REPORT_CALLBACK_PREFIX = 'report:';
const ACCOUNT_CALLBACK_PREFIX = 'reportaccount:';
const MODE_CALLBACK_PREFIX = 'reportmode:';
const INTERVAL_CALLBACK_PREFIX = 'reportinterval:';

const TRADE_CONVERSATION_ID = 'trade';
// Display (camelCase) names shown in `/help` and usage errors. grammY
// registration uses the lowercased form so command matching stays
// case-insensitive via the middleware installed in the constructor.
const TRADE_COMMAND_NAMES = ['buyMarket', 'sellMarket', 'buyLimit', 'sellLimit'] as const;
type TradeCommandName = (typeof TRADE_COMMAND_NAMES)[number];

interface TradeCommandShape {
  side: ExchangeOrderSide;
  isLimit: boolean;
}

function tradeCommandShape(name: TradeCommandName): TradeCommandShape {
  switch (name) {
    case 'buyMarket':
      return {side: ExchangeOrderSide.BUY, isLimit: false};
    case 'sellMarket':
      return {side: ExchangeOrderSide.SELL, isLimit: false};
    case 'buyLimit':
      return {side: ExchangeOrderSide.BUY, isLimit: true};
    case 'sellLimit':
      return {side: ExchangeOrderSide.SELL, isLimit: true};
  }
}

function buildTradeActionLabel(
  cmd: TradeCommandName,
  pair: TradingPair,
  quantity: string,
  limitPrice: string | null
): string {
  const {side, isLimit} = tradeCommandShape(cmd);
  const sideLabel = side === ExchangeOrderSide.BUY ? 'BUY' : 'SELL';
  const kindLabel = isLimit ? 'LIMIT' : 'MARKET';
  if (isLimit && limitPrice !== null) {
    return `${kindLabel} ${sideLabel} ${quantity} ${pair.base} @ ${limitPrice} ${pair.counter}`;
  }
  return `${kindLabel} ${sideLabel} ${quantity} ${pair.base}`;
}

type TradeContext = ConversationFlavor<Context>;
type TradeConversation = Conversation<TradeContext, TradeContext>;

const positiveNumber = z.coerce.number().positive().finite();

interface TradeArgs {
  cmd: TradeCommandName;
  pairStr: string;
  quantity: string;
  /** Undefined for market orders, positive-number string for limit orders. */
  limitPrice?: string;
}

/**
 * Parses the raw text following a /buymarket / /sellmarket / /buylimit / /selllimit
 * command into validated args. Returns `null` and replies with the usage error if
 * anything is off — the caller can just return early.
 */
async function parseTradeCommandInput(
  ctx: Context,
  cmd: TradeCommandName
): Promise<TradeArgs | null> {
  const {isLimit} = tradeCommandShape(cmd);

  const text = ctx.message?.text ?? '';
  const firstSpace = text.indexOf(' ');
  const content = firstSpace === -1 ? '' : text.slice(firstSpace + 1).trim();
  const parts = content.length > 0 ? content.split(/\s+/) : [];
  const expected = isLimit ? 3 : 2;

  if (parts.length !== expected) {
    const usage = isLimit
      ? `Usage: /${cmd} <PAIR> <QTY> <PRICE>\nExample: /${cmd} AAPL,USD 100 150`
      : `Usage: /${cmd} <PAIR> <QTY>\nExample: /${cmd} AAPL,USD 100`;
    await ctx.reply(`Invalid format.\n${usage}`);
    return null;
  }

  const [pairStr, quantity, priceInput] = parts;

  try {
    TradingPair.fromString(pairStr, ',');
  } catch {
    await ctx.reply(`Invalid pair "${pairStr}". Use format: BASE,COUNTER (e.g. AAPL,USD)`);
    return null;
  }

  const quantityCheck = positiveNumber.safeParse(quantity);
  if (!quantityCheck.success) {
    await ctx.reply(`Invalid quantity "${quantity}". Must be a positive number.`);
    return null;
  }

  if (isLimit) {
    const priceCheck = positiveNumber.safeParse(priceInput);
    if (!priceCheck.success) {
      await ctx.reply(`Invalid price "${priceInput}". Must be a positive number.`);
      return null;
    }
  }

  return {
    cmd,
    pairStr,
    quantity: String(quantityCheck.data),
    limitPrice: isLimit ? String(positiveNumber.parse(priceInput)) : undefined,
  };
}

/**
 * The full trade wizard, expressed as a linear async function. Each `await`
 * detaches and resumes when the user clicks the next button — the plugin
 * handles state and routing for us. No `callback_data` encoding, no manual
 * dispatcher, no step-state machine.
 */
async function tradeWizard(
  conversation: TradeConversation,
  ctx: TradeContext,
  args: TradeArgs
): Promise<void> {
  const senderId = ctx.from?.id?.toString();
  if (!senderId) {
    await ctx.reply('Unable to determine sender');
    return;
  }
  const userId = `${PLATFORM_PREFIX}${senderId}`;

  // Account lookup touches the database — wrap it in `external` so the
  // conversations engine records the value in the replay log instead of
  // re-executing the query on every resume. Only return the fields needed
  // for the picker so sensitive credentials are not persisted in replay state.
  const accounts = await conversation.external(() =>
    Account.findByUserId(userId).map(acc => ({
      id: acc.id,
      name: acc.name,
      exchange: acc.exchange,
      isPaper: acc.isPaper,
    }))
  );

  if (accounts.length === 0) {
    await ctx.reply('No exchange account found. Use /accountAdd to add one first.');
    return;
  }

  const pair = TradingPair.fromString(args.pairStr, ',');
  const actionLabel = buildTradeActionLabel(args.cmd, pair, args.quantity, args.limitPrice ?? null);

  // Step 1: account picker
  const accountButtons: InlineButton[][] = accounts.map(acc => [
    {
      text: `${acc.name} (${acc.exchange}${acc.isPaper ? ' paper' : ''})`,
      callback_data: `trade:acc:${acc.id}`,
    },
  ]);
  await ctx.reply(`${actionLabel}\nSelect an account:`, inlineKeyboard(accountButtons));

  const accountSelection = await conversation.waitForCallbackQuery(
    accounts.map(acc => `trade:acc:${acc.id}`)
  );
  // `match` is `string | RegExpMatchArray` in the type system, but since we
  // only pass literal strings as triggers it's always a string at runtime.
  const selectedData = typeof accountSelection.match === 'string' ? accountSelection.match : '';
  const accountId = Number.parseInt(selectedData.split(':')[2] ?? '', 10);

  // Step 2: fetch price context + show confirmation
  const confirmation = await conversation.external(() =>
    buildTradeConfirmation(userId, args, pair, accountId)
  );
  await accountSelection.answerCallbackQuery();
  await accountSelection.editMessageText(confirmation.text, confirmation.keyboard);

  // Step 3: wait for Yes / No
  const decision = await conversation.waitForCallbackQuery(['trade:cnf:y', 'trade:cnf:n']);
  if (decision.match === 'trade:cnf:n') {
    await decision.answerCallbackQuery();
    await decision.editMessageText('Cancelled.');
    return;
  }

  // Step 4: execute
  await decision.answerCallbackQuery();
  await decision.editMessageText('Placing order…');
  const result = await conversation.external(() =>
    placeOrder({
      userId,
      accountId,
      pair,
      side: tradeCommandShape(args.cmd).side,
      quantity: args.quantity,
      limitPrice: args.limitPrice,
    })
  );
  await decision.editMessageText(result);
}

async function buildTradeConfirmation(
  userId: string,
  args: TradeArgs,
  pair: TradingPair,
  accountId: number
): Promise<{text: string; keyboard: ReturnType<typeof inlineKeyboard>}> {
  const account = Account.findByUserIdAndId(userId, accountId);
  if (!account) {
    return {
      text: `Account "${accountId}" not found. Run the command again.`,
      keyboard: inlineKeyboard([]),
    };
  }

  const actionLabel = buildTradeActionLabel(args.cmd, pair, args.quantity, args.limitPrice ?? null);

  // Fetch current price as confirmation context. Failure is non-fatal —
  // the user still sees the action and can confirm without the price hint.
  let priceContext = '';
  try {
    const client = getExchangeClient({
      exchangeId: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isPaper: account.isPaper,
    });
    const smallestInterval = client.getSmallestInterval();
    const candle = await client.getLatestCandle(pair, smallestInterval);
    priceContext = `\nCurrent ~${candle.close} ${pair.counter}`;
  } catch {
    // Ignore — price context is best-effort.
  }

  const text = `${actionLabel}\nAccount: ${account.name}${priceContext}\n\nProceed?`;
  const keyboard = inlineKeyboard([
    [
      {text: '✓ Yes, place order', callback_data: 'trade:cnf:y'},
      {text: '✗ Cancel', callback_data: 'trade:cnf:n'},
    ],
  ]);

  return {text, keyboard};
}

interface InlineButton {
  text: string;
  callback_data: string;
}

function inlineKeyboard(rows: InlineButton[][]) {
  return {reply_markup: {inline_keyboard: rows}};
}

/**
 * Rewrites the bot_command entity at offset 0 to lowercase so grammY's
 * case-sensitive command matching accepts any casing from the user. Only
 * the command name is lowercased — the optional `@botname` suffix and any
 * arguments after the command are left untouched.
 *
 * Exported for unit tests.
 */
export async function lowercaseCommandMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
  const message = ctx.message ?? ctx.channelPost;
  const text = message?.text;
  const entities = message?.entities;
  if (text && entities) {
    const entity = entities.find(e => e.type === 'bot_command' && e.offset === 0);
    if (entity) {
      const rawCommand = text.slice(0, entity.length);
      const atIndex = rawCommand.indexOf('@');
      const nameEnd = atIndex === -1 ? rawCommand.length : atIndex;
      const normalized = rawCommand.slice(0, nameEnd).toLowerCase() + rawCommand.slice(nameEnd);
      if (normalized !== rawCommand) {
        (message as {text: string}).text = normalized + text.slice(entity.length);
      }
    }
  }
  await next();
}

async function replyWithMarkdown(ctx: Context, text: string): Promise<void> {
  for (const chunk of splitForTelegram(text)) {
    try {
      await ctx.reply(markdownToTelegramHtml(chunk), {parse_mode: 'HTML'});
    } catch {
      await ctx.reply(chunk);
    }
  }
}

export class TelegramPlatform implements MessagingPlatform {
  #bot: Bot<TradeContext>;
  #ownerIds: string[];
  #commands: Map<string, CommandHandler> = new Map();
  #platformInfo: PlatformInfo = {botAddress: '', sdkVersion: ''};
  #reportScheduler?: ReportScheduler;

  constructor(botToken: string, ownerIds?: string) {
    this.#bot = new Bot<TradeContext>(botToken);
    this.#ownerIds = ownerIds ? ownerIds.split(',').map(id => id.trim()) : [];

    // Normalize incoming /Commands to lowercase so grammY's case-sensitive
    // command matching accepts any casing (/reportAdd, /REPORTADD, /repOrTADd).
    // Must run before the command handlers installed below.
    this.#bot.use(lowercaseCommandMiddleware);

    // Install @grammyjs/conversations plugin BEFORE any command handlers are
    // registered. The `conversations()` middleware must run for every update
    // so it can resume active sessions on subsequent callback_query updates,
    // and `createConversation(...)` has to be visible to the command handler
    // that calls `ctx.conversation.enter(...)`.
    this.#bot.use(conversations());
    this.#bot.use(createConversation(tradeWizard, TRADE_CONVERSATION_ID));

    // Trade commands are Telegram-specific: they need inline keyboards and
    // the conversations plugin, so they register themselves directly here
    // instead of going through the cross-platform `registerCommand` interface.
    for (const name of TRADE_COMMAND_NAMES) {
      this.#registerTradeCommand(name);
    }
  }

  setReportScheduler(scheduler: ReportScheduler): void {
    this.#reportScheduler = scheduler;
  }

  registerCommand(name: string | string[], handler: CommandHandler): void {
    const names = Array.isArray(name) ? name : [name];
    for (const n of names) {
      this.#commands.set(n, handler);
    }
    const lowerNames = names.map(n => n.toLowerCase());

    // reportadd is handled via inline keyboard buttons
    if (lowerNames.includes('reportadd')) {
      this.#registerReportAddCommand();
      return;
    }

    this.#bot.command(lowerNames, async ctx => {
      const senderId = ctx.from?.id?.toString();

      if (!senderId) {
        await ctx.reply('Unable to determine sender');
        return;
      }

      if (this.#ownerIds.length > 0 && !this.#ownerIds.includes(senderId)) {
        console.warn(
          `Ignoring Telegram message from "${senderId}" - only messages from owners [${this.#ownerIds.join(', ')}] are processed.`
        );
        return;
      }

      // Extract text after the /command
      const text = ctx.message?.text ?? '';
      const commandEnd = text.indexOf(' ');
      const content = commandEnd === -1 ? '' : text.slice(commandEnd + 1);

      const messageCtx: MessageContext = {
        senderId: `${PLATFORM_PREFIX}${senderId}`,
        platformId: 'telegram',
        content,
        reply: async (replyText: string) => {
          await replyWithMarkdown(ctx, replyText);
        },
      };

      await handler(messageCtx);
    });
  }

  #registerReportAddCommand(): void {
    this.#bot.command('reportadd', async ctx => {
      const senderId = ctx.from?.id?.toString();

      if (!senderId) {
        await ctx.reply('Unable to determine sender');
        return;
      }

      if (this.#ownerIds.length > 0 && !this.#ownerIds.includes(senderId)) {
        return;
      }

      const available = getAvailableReportNames();
      if (available.length === 0) {
        await ctx.reply('No reports available. Check that the required environment variables are set.');
        return;
      }

      const rows: InlineButton[][] = available.map(name => [
        {text: name, callback_data: `${REPORT_CALLBACK_PREFIX}${name}`},
      ]);

      await ctx.reply('Select a report to run:', inlineKeyboard(rows));
    });

    // Step 2: User selected a report — if it needs an account, ask for one; otherwise ask run mode
    this.#bot.callbackQuery(new RegExp(`^${REPORT_CALLBACK_PREFIX}(.+)$`), async ctx => {
      await ctx.answerCallbackQuery();

      const reportName = ctx.match[1];
      const senderId = ctx.from?.id?.toString();
      if (!senderId) return;

      if (reportRequiresAccount(reportName)) {
        const userId = `${PLATFORM_PREFIX}${senderId}`;
        const userAccounts = Account.findByUserId(userId);

        if (userAccounts.length === 0) {
          await ctx.editMessageText(`Report "${reportName}" requires an exchange account.\nUse /accountAdd to add one first.`);
          return;
        }

        const rows: InlineButton[][] = userAccounts.map(acc => [
          {
            text: `${acc.name} (${acc.exchange}${acc.isPaper ? ' paper' : ''})`,
            callback_data: `${ACCOUNT_CALLBACK_PREFIX}${acc.id}:${reportName}`,
          },
        ]);

        await ctx.editMessageText(`Report: ${reportName}\nSelect an account:`, inlineKeyboard(rows));
        return;
      }

      await ctx.editMessageText(
        `Report: ${reportName}\nRun once or schedule recurring?`,
        inlineKeyboard([
          [{text: 'Run once', callback_data: `${MODE_CALLBACK_PREFIX}once:${reportName}`}],
          [{text: 'Schedule recurring', callback_data: `${MODE_CALLBACK_PREFIX}schedule:${reportName}`}],
        ])
      );
    });

    // Step 2b: User selected an account — ask run mode
    this.#bot.callbackQuery(new RegExp(`^${ACCOUNT_CALLBACK_PREFIX}(\\d+):(.+)$`), async ctx => {
      await ctx.answerCallbackQuery();

      const accountId = ctx.match[1];
      const reportName = ctx.match[2];

      // Carry accountId through by appending it to the reportName in the callback data
      const reportWithAccount = `${reportName} ${accountId}`;

      await ctx.editMessageText(
        `Report: ${reportName} (account ${accountId})\nRun once or schedule recurring?`,
        inlineKeyboard([
          [{text: 'Run once', callback_data: `${MODE_CALLBACK_PREFIX}once:${reportWithAccount}`}],
          [{text: 'Schedule recurring', callback_data: `${MODE_CALLBACK_PREFIX}schedule:${reportWithAccount}`}],
        ])
      );
    });

    // Step 3a: Run once
    this.#bot.callbackQuery(new RegExp(`^${MODE_CALLBACK_PREFIX}once:(.+)$`), async ctx => {
      await ctx.answerCallbackQuery();

      const reportInput = ctx.match[1];
      const senderId = ctx.from?.id?.toString();
      if (!senderId) return;

      await ctx.editMessageText(`Running report: ${reportInput.split(' ')[0]}...`);

      const userId = `${PLATFORM_PREFIX}${senderId}`;
      const result = await reportAdd(reportInput, userId);

      await replyWithMarkdown(ctx, result.message);
    });

    // Step 3b: Schedule — ask for interval
    this.#bot.callbackQuery(new RegExp(`^${MODE_CALLBACK_PREFIX}schedule:(.+)$`), async ctx => {
      await ctx.answerCallbackQuery();

      const reportInput = ctx.match[1];
      const reportName = reportInput.split(' ')[0];

      await ctx.editMessageText(
        `Report: ${reportName}\nSelect interval:`,
        inlineKeyboard([
          [
            {text: '1m', callback_data: `${INTERVAL_CALLBACK_PREFIX}1m:${reportInput}`},
            {text: '1h', callback_data: `${INTERVAL_CALLBACK_PREFIX}1h:${reportInput}`},
            {text: '6h', callback_data: `${INTERVAL_CALLBACK_PREFIX}6h:${reportInput}`},
          ],
          [
            {text: '12h', callback_data: `${INTERVAL_CALLBACK_PREFIX}12h:${reportInput}`},
            {text: '1d', callback_data: `${INTERVAL_CALLBACK_PREFIX}1d:${reportInput}`},
            {text: '1w', callback_data: `${INTERVAL_CALLBACK_PREFIX}1w:${reportInput}`},
          ],
        ])
      );
    });

    // Step 4: Schedule with chosen interval
    this.#bot.callbackQuery(new RegExp(`^${INTERVAL_CALLBACK_PREFIX}([^:]+):(.+)$`), async ctx => {
      await ctx.answerCallbackQuery();

      const interval = ctx.match[1];
      const reportInput = ctx.match[2];
      const senderId = ctx.from?.id?.toString();
      if (!senderId) return;

      const userId = `${PLATFORM_PREFIX}${senderId}`;
      let intervalMs: number;
      try {
        intervalMs = assertInterval(interval);
      } catch {
        await ctx.editMessageText(`Invalid interval "${interval}". Please select one of: 1m, 1h, 6h, 12h, 1d, 1w.`);
        return;
      }

      await ctx.editMessageText(`Scheduling report: ${reportInput.split(' ')[0]} every ${interval}...`);
      const result = await reportAdd(reportInput, userId, {intervalMs});

      await replyWithMarkdown(ctx, result.message);

      if (result.report?.intervalMs && this.#reportScheduler) {
        this.#reportScheduler.scheduleReport(result.report);
      }
    });
  }

  #registerTradeCommand(name: TradeCommandName): void {
    // Record the camelCase name so it appears in `/help`. The handler stored
    // here is never invoked directly — the real wizard runs via the
    // `bot.command(...)` handler installed below — but `commandList` reads
    // from `#commands`.
    this.#commands.set(name, async () => {});

    this.#bot.command(name.toLowerCase(), async ctx => {
      const senderId = ctx.from?.id?.toString();
      if (!senderId) {
        await ctx.reply('Unable to determine sender');
        return;
      }

      if (this.#ownerIds.length > 0 && !this.#ownerIds.includes(senderId)) {
        return;
      }

      const args = await parseTradeCommandInput(ctx, name);
      if (!args) return; // parseTradeCommandInput already replied with the usage error

      await ctx.conversation.enter(TRADE_CONVERSATION_ID, args);
    });
  }

  async start(): Promise<void> {
    if (this.#ownerIds.length > 0) {
      console.log(`Only Telegram user IDs (${this.#ownerIds.join(', ')}) can message the bot.`);
    } else {
      console.warn('Warning: TELEGRAM_OWNER_IDS is not set. Everyone can message the bot via Telegram.');
    }

    await this.#bot.init();
    this.#platformInfo = {
      botAddress: `@${this.#bot.botInfo.username}`,
      sdkVersion: 'grammY',
    };

    // bot.start() resolves only when the bot is stopped, so we don't await it —
    // we want start() to return to the caller once polling is running.
    this.#bot.start({drop_pending_updates: true}).catch((err: unknown) => {
      console.error('Telegram bot polling error:', err);
    });

    console.log(`Telegram bot started as ${this.#platformInfo.botAddress}.`);
  }

  async stop(): Promise<void> {
    await this.#bot.stop();
  }

  async sendMessage(userId: string, text: string): Promise<void> {
    const chatId = userId.replace(PLATFORM_PREFIX, '');
    for (const chunk of splitForTelegram(text)) {
      try {
        await this.#bot.api.sendMessage(chatId, markdownToTelegramHtml(chunk), {parse_mode: 'HTML'});
      } catch {
        await this.#bot.api.sendMessage(chatId, chunk);
      }
    }
  }

  get commandList(): string[] {
    return Array.from(this.#commands.keys()).map(cmd => `/${cmd}`);
  }

  get platformInfo(): PlatformInfo {
    return this.#platformInfo;
  }
}
