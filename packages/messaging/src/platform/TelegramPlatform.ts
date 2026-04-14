import {Bot} from 'grammy';
import type {Context} from 'grammy';
import {ExchangeOrderSide, TradingPair, getExchangeClient} from '@typedtrader/exchange';
import {getAvailableReportNames, reportRequiresAccount} from 'trading-strategies';
import type {CommandHandler, MessageContext, MessagingPlatform, PlatformInfo} from './MessagingPlatform.js';
import {markdownToTelegramHtml, splitForTelegram} from './telegramMarkdown.js';
import {placeOrder} from '../command/placeOrder.js';
import {reportAdd} from '../command/report/reportAdd.js';
import {Account} from '../database/models/Account.js';
import type {ReportScheduler} from '../service/ReportScheduler.js';

const PLATFORM_PREFIX = 'telegram:';
const REPORT_CALLBACK_PREFIX = 'report:';
const ACCOUNT_CALLBACK_PREFIX = 'reportaccount:';
const MODE_CALLBACK_PREFIX = 'reportmode:';
const INTERVAL_CALLBACK_PREFIX = 'reportinterval:';
const TRADE_ACCOUNT_PREFIX = 't:a|';
const TRADE_CONFIRM_PREFIX = 't:c|';

const TRADE_COMMAND_NAMES = ['buyMarket', 'sellMarket', 'buyLimit', 'sellLimit'] as const;
type TradeCommandName = (typeof TRADE_COMMAND_NAMES)[number];

function isTradeCommandName(name: string): name is TradeCommandName {
  return (TRADE_COMMAND_NAMES as readonly string[]).includes(name);
}

const TRADE_CODE_TO_COMMAND: Record<string, TradeCommandName> = {
  bm: 'buyMarket',
  sm: 'sellMarket',
  bl: 'buyLimit',
  sl: 'sellLimit',
};

const TRADE_COMMAND_TO_CODE: Record<TradeCommandName, string> = {
  buyMarket: 'bm',
  sellMarket: 'sm',
  buyLimit: 'bl',
  sellLimit: 'sl',
};

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

interface TradeFields {
  cmd: TradeCommandName;
  pairStr: string;
  quantity: string;
  /** `'-'` for market orders, a positive-number string for limit orders. */
  priceField: string;
  accountId: number;
}

function encodeTradeFields(prefix: string, fields: TradeFields, decision?: 'y' | 'n'): string {
  const code = TRADE_COMMAND_TO_CODE[fields.cmd];
  const base = `${prefix}${code}|${fields.pairStr}|${fields.quantity}|${fields.priceField}|${fields.accountId}`;
  return decision ? `${base}|${decision}` : base;
}

function decodeTradeFields(payload: string): (TradeFields & {decision?: 'y' | 'n'}) | null {
  const parts = payload.split('|');
  if (parts.length < 5 || parts.length > 6) {
    return null;
  }
  const [code, pairStr, quantity, priceField, accountIdStr, decision] = parts;
  const cmd = TRADE_CODE_TO_COMMAND[code];
  if (!cmd) return null;
  const accountId = Number.parseInt(accountIdStr, 10);
  if (!Number.isFinite(accountId)) return null;
  if (decision !== undefined && decision !== 'y' && decision !== 'n') return null;
  return {cmd, pairStr, quantity, priceField, accountId, decision};
}

interface InlineButton {
  text: string;
  callback_data: string;
}

function inlineKeyboard(rows: InlineButton[][]) {
  return {reply_markup: {inline_keyboard: rows}};
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
  #bot: Bot;
  #ownerIds: string[];
  #commands: Map<string, CommandHandler> = new Map();
  #platformInfo: PlatformInfo = {botAddress: '', sdkVersion: ''};
  #reportScheduler?: ReportScheduler;
  #tradeCallbacksRegistered = false;

  constructor(botToken: string, ownerIds?: string) {
    this.#bot = new Bot(botToken);
    this.#ownerIds = ownerIds ? ownerIds.split(',').map(id => id.trim()) : [];
  }

  setReportScheduler(scheduler: ReportScheduler): void {
    this.#reportScheduler = scheduler;
  }

  registerCommand(name: string | string[], handler: CommandHandler): void {
    const names = Array.isArray(name) ? name : [name];
    for (const n of names) {
      this.#commands.set(n, handler);
    }

    // reportadd is handled via inline keyboard buttons
    if (names.includes('reportadd')) {
      this.#registerReportAddCommand();
      return;
    }

    // Trade commands have their own wizard (account picker → confirmation → execute)
    const tradeNames = names.filter(isTradeCommandName);
    if (tradeNames.length > 0) {
      for (const tradeName of tradeNames) {
        this.#registerTradeCommand(tradeName);
      }
      if (!this.#tradeCallbacksRegistered) {
        this.#tradeCallbacksRegistered = true;
        this.#registerTradeCallbacks();
      }
      return;
    }

    this.#bot.command(names, async ctx => {
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
          await ctx.editMessageText(`Report "${reportName}" requires an exchange account.\nUse /accountadd to add one first.`);
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

      await ctx.editMessageText(`Scheduling report: ${reportInput.split(' ')[0]} every ${interval}...`);

      const userId = `${PLATFORM_PREFIX}${senderId}`;
      const result = await reportAdd(`${reportInput} --every ${interval}`, userId);

      await replyWithMarkdown(ctx, result.message);

      if (result.report?.intervalMs && this.#reportScheduler) {
        this.#reportScheduler.scheduleReport(result.report);
      }
    });
  }

  #registerTradeCommand(name: TradeCommandName): void {
    const {isLimit} = tradeCommandShape(name);

    this.#bot.command(name, async ctx => {
      const senderId = ctx.from?.id?.toString();
      if (!senderId) {
        await ctx.reply('Unable to determine sender');
        return;
      }

      if (this.#ownerIds.length > 0 && !this.#ownerIds.includes(senderId)) {
        return;
      }

      const text = ctx.message?.text ?? '';
      const firstSpace = text.indexOf(' ');
      const content = firstSpace === -1 ? '' : text.slice(firstSpace + 1).trim();
      const parts = content.length > 0 ? content.split(/\s+/) : [];
      const expected = isLimit ? 3 : 2;

      if (parts.length !== expected) {
        const usage = isLimit
          ? `Usage: /${name} <PAIR> <QTY> <PRICE>\nExample: /${name} AAPL,USD 100 150`
          : `Usage: /${name} <PAIR> <QTY>\nExample: /${name} AAPL,USD 100`;
        await ctx.reply(`Invalid format.\n${usage}`);
        return;
      }

      const [pairStr, quantity, priceInput] = parts;

      let pair: TradingPair;
      try {
        pair = TradingPair.fromString(pairStr, ',');
      } catch {
        await ctx.reply(`Invalid pair "${pairStr}". Use format: BASE,COUNTER (e.g. AAPL,USD)`);
        return;
      }

      if (!/^\d+(\.\d+)?$/.test(quantity) || Number.parseFloat(quantity) <= 0) {
        await ctx.reply(`Invalid quantity "${quantity}". Must be a positive number.`);
        return;
      }

      if (isLimit) {
        if (!/^\d+(\.\d+)?$/.test(priceInput) || Number.parseFloat(priceInput) <= 0) {
          await ctx.reply(`Invalid price "${priceInput}". Must be a positive number.`);
          return;
        }
      }

      const priceField = isLimit ? priceInput : '-';
      const userId = `${PLATFORM_PREFIX}${senderId}`;
      const accounts = Account.findByUserId(userId);

      if (accounts.length === 0) {
        await ctx.reply('No exchange account found. Use /accountadd to add one first.');
        return;
      }

      const actionLabel = buildTradeActionLabel(name, pair, quantity, isLimit ? priceInput : null);
      const rows: InlineButton[][] = accounts.map(acc => [
        {
          text: `${acc.name} (${acc.exchange}${acc.isPaper ? ' paper' : ''})`,
          callback_data: encodeTradeFields(TRADE_ACCOUNT_PREFIX, {
            cmd: name,
            pairStr,
            quantity,
            priceField,
            accountId: acc.id,
          }),
        },
      ]);

      await ctx.reply(`${actionLabel}\nSelect an account:`, inlineKeyboard(rows));
    });
  }

  #registerTradeCallbacks(): void {
    // A single catch-all callback_query:data handler that dispatches by prefix.
    // Using plain `.startsWith` avoids building a RegExp from the constants,
    // which would require escaping the `|` delimiter (CodeQL caught the partial
    // escape in an earlier iteration). The filter only fires when data is
    // present, and non-trade prefixes are ignored so other handlers are
    // unaffected.
    this.#bot.on('callback_query:data', async ctx => {
      const data = ctx.callbackQuery.data;

      if (data.startsWith(TRADE_ACCOUNT_PREFIX)) {
        await this.#handleTradeAccountSelected(ctx, data.slice(TRADE_ACCOUNT_PREFIX.length));
        return;
      }

      if (data.startsWith(TRADE_CONFIRM_PREFIX)) {
        await this.#handleTradeConfirmation(ctx, data.slice(TRADE_CONFIRM_PREFIX.length));
        return;
      }
    });
  }

  async #handleTradeAccountSelected(ctx: Context, payload: string): Promise<void> {
    await ctx.answerCallbackQuery();

    const senderId = ctx.from?.id?.toString();
    if (!senderId) return;

    const fields = decodeTradeFields(payload);
    if (!fields) {
      await ctx.editMessageText('Invalid trade session. Please run the command again.');
      return;
    }

    const userId = `${PLATFORM_PREFIX}${senderId}`;
    const {text, keyboard} = await this.#buildTradeConfirmation(userId, fields);
    await ctx.editMessageText(text, keyboard);
  }

  async #handleTradeConfirmation(ctx: Context, payload: string): Promise<void> {
    await ctx.answerCallbackQuery();

    const senderId = ctx.from?.id?.toString();
    if (!senderId) return;

    const fields = decodeTradeFields(payload);
    if (!fields || fields.decision === undefined) {
      await ctx.editMessageText('Invalid trade session. Please run the command again.');
      return;
    }

    if (fields.decision === 'n') {
      await ctx.editMessageText('Cancelled.');
      return;
    }

    const userId = `${PLATFORM_PREFIX}${senderId}`;
    let pair: TradingPair;
    try {
      pair = TradingPair.fromString(fields.pairStr, ',');
    } catch (error) {
      await ctx.editMessageText(error instanceof Error ? error.message : 'Invalid pair.');
      return;
    }

    const {side, isLimit} = tradeCommandShape(fields.cmd);
    const limitPrice = isLimit && fields.priceField !== '-' ? fields.priceField : undefined;

    await ctx.editMessageText('Placing order…');

    const result = await placeOrder({
      userId,
      accountId: fields.accountId,
      pair,
      side,
      quantity: fields.quantity,
      limitPrice,
    });

    await ctx.editMessageText(result);
  }

  async #buildTradeConfirmation(
    userId: string,
    fields: TradeFields
  ): Promise<{text: string; keyboard: ReturnType<typeof inlineKeyboard>}> {
    const account = Account.findByUserIdAndId(userId, fields.accountId);
    if (!account) {
      return {
        text: `Account "${fields.accountId}" not found. Run the command again.`,
        keyboard: inlineKeyboard([]),
      };
    }

    let pair: TradingPair;
    try {
      pair = TradingPair.fromString(fields.pairStr, ',');
    } catch (error) {
      return {
        text: error instanceof Error ? error.message : 'Invalid pair.',
        keyboard: inlineKeyboard([]),
      };
    }

    const limitPriceLabel = fields.priceField === '-' ? null : fields.priceField;
    const actionLabel = buildTradeActionLabel(fields.cmd, pair, fields.quantity, limitPriceLabel);

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
      const currentPrice = Number.parseFloat(candle.close);
      const qty = Number.parseFloat(fields.quantity);
      if (Number.isFinite(currentPrice) && Number.isFinite(qty)) {
        const estimated = (currentPrice * qty).toFixed(2);
        priceContext = `\nCurrent ~${candle.close} ${pair.counter} · Estimated ~${estimated} ${pair.counter}`;
      }
    } catch {
      // Ignore — price context is best-effort.
    }

    const text = `${actionLabel}\nAccount: ${account.name}${priceContext}\n\nProceed?`;
    const keyboard = inlineKeyboard([
      [
        {
          text: '✓ Yes, place order',
          callback_data: encodeTradeFields(TRADE_CONFIRM_PREFIX, fields, 'y'),
        },
        {
          text: '✗ Cancel',
          callback_data: encodeTradeFields(TRADE_CONFIRM_PREFIX, fields, 'n'),
        },
      ],
    ]);

    return {text, keyboard};
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
