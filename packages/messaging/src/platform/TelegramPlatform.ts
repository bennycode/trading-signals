import {Bot} from 'grammy';
import type {Context} from 'grammy';
import {getAvailableReportNames, reportRequiresAccount} from 'trading-strategies';
import type {CommandHandler, MessageContext, MessagingPlatform, PlatformInfo} from './MessagingPlatform.js';
import {markdownToTelegramHtml, splitForTelegram} from './telegramMarkdown.js';
import {reportAdd} from '../command/report/reportAdd.js';
import {Account} from '../database/models/Account.js';
import type {ReportScheduler} from '../service/ReportScheduler.js';

const PLATFORM_PREFIX = 'telegram:';
const REPORT_CALLBACK_PREFIX = 'report:';
const ACCOUNT_CALLBACK_PREFIX = 'reportaccount:';
const MODE_CALLBACK_PREFIX = 'reportmode:';
const INTERVAL_CALLBACK_PREFIX = 'reportinterval:';

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
