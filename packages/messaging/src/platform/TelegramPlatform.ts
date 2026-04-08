import {Markup, Telegraf} from 'telegraf';
import type {Context} from 'telegraf';
import {getAvailableReportNames, reportRequiresAccount} from 'trading-strategies';
import type {CommandHandler, MessageContext, MessagingPlatform, PlatformInfo} from './MessagingPlatform.js';
import {reportAdd} from '../command/report/reportAdd.js';
import {Account} from '../database/models/Account.js';
import type {ReportScheduler} from '../service/ReportScheduler.js';

const PLATFORM_PREFIX = 'telegram:';
const REPORT_CALLBACK_PREFIX = 'report:';
const ACCOUNT_CALLBACK_PREFIX = 'reportaccount:';
const MODE_CALLBACK_PREFIX = 'reportmode:';
const INTERVAL_CALLBACK_PREFIX = 'reportinterval:';

async function replyWithMarkdown(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text, {parse_mode: 'MarkdownV2'});
  } catch {
    await ctx.reply(text);
  }
}

export class TelegramPlatform implements MessagingPlatform {
  #bot: Telegraf;
  #ownerIds: string[];
  #commands: Map<string, CommandHandler> = new Map();
  #platformInfo: PlatformInfo = {botAddress: '', sdkVersion: ''};
  #reportScheduler?: ReportScheduler;

  constructor(botToken: string, ownerIds?: string) {
    this.#bot = new Telegraf(botToken);
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
      const text = ctx.message.text;
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

      const buttons = available.map(name => [Markup.button.callback(name, `${REPORT_CALLBACK_PREFIX}${name}`)]);

      await ctx.reply('Select a report to run:', Markup.inlineKeyboard(buttons));
    });

    // Step 2: User selected a report — if it needs an account, ask for one; otherwise ask run mode
    this.#bot.action(new RegExp(`^${REPORT_CALLBACK_PREFIX}(.+)$`), async ctx => {
      await ctx.answerCbQuery();

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

        const buttons = userAccounts.map(acc => [
          Markup.button.callback(
            `${acc.name} (${acc.exchange}${acc.isPaper ? ' paper' : ''})`,
            `${ACCOUNT_CALLBACK_PREFIX}${acc.id}:${reportName}`
          ),
        ]);

        await ctx.editMessageText(`Report: ${reportName}\nSelect an account:`, Markup.inlineKeyboard(buttons));
        return;
      }

      await ctx.editMessageText(
        `Report: ${reportName}\nRun once or schedule recurring?`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Run once', `${MODE_CALLBACK_PREFIX}once:${reportName}`)],
          [Markup.button.callback('Schedule recurring', `${MODE_CALLBACK_PREFIX}schedule:${reportName}`)],
        ])
      );
    });

    // Step 2b: User selected an account — ask run mode
    this.#bot.action(new RegExp(`^${ACCOUNT_CALLBACK_PREFIX}(\\d+):(.+)$`), async ctx => {
      await ctx.answerCbQuery();

      const accountId = ctx.match[1];
      const reportName = ctx.match[2];

      // Carry accountId through by appending it to the reportName in the callback data
      const reportWithAccount = `${reportName} ${accountId}`;

      await ctx.editMessageText(
        `Report: ${reportName} (account ${accountId})\nRun once or schedule recurring?`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Run once', `${MODE_CALLBACK_PREFIX}once:${reportWithAccount}`)],
          [Markup.button.callback('Schedule recurring', `${MODE_CALLBACK_PREFIX}schedule:${reportWithAccount}`)],
        ])
      );
    });

    // Step 3a: Run once
    this.#bot.action(new RegExp(`^${MODE_CALLBACK_PREFIX}once:(.+)$`), async ctx => {
      await ctx.answerCbQuery();

      const reportInput = ctx.match[1];
      const senderId = ctx.from?.id?.toString();
      if (!senderId) return;

      await ctx.editMessageText(`Running report: ${reportInput.split(' ')[0]}...`);

      const userId = `${PLATFORM_PREFIX}${senderId}`;
      const result = await reportAdd(reportInput, userId);

      await replyWithMarkdown(ctx, result.message);
    });

    // Step 3b: Schedule — ask for interval
    this.#bot.action(new RegExp(`^${MODE_CALLBACK_PREFIX}schedule:(.+)$`), async ctx => {
      await ctx.answerCbQuery();

      const reportInput = ctx.match[1];
      const reportName = reportInput.split(' ')[0];

      await ctx.editMessageText(
        `Report: ${reportName}\nSelect interval:`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('1m', `${INTERVAL_CALLBACK_PREFIX}1m:${reportInput}`),
            Markup.button.callback('1h', `${INTERVAL_CALLBACK_PREFIX}1h:${reportInput}`),
            Markup.button.callback('6h', `${INTERVAL_CALLBACK_PREFIX}6h:${reportInput}`),
          ],
          [
            Markup.button.callback('12h', `${INTERVAL_CALLBACK_PREFIX}12h:${reportInput}`),
            Markup.button.callback('1d', `${INTERVAL_CALLBACK_PREFIX}1d:${reportInput}`),
            Markup.button.callback('1w', `${INTERVAL_CALLBACK_PREFIX}1w:${reportInput}`),
          ],
        ])
      );
    });

    // Step 4: Schedule with chosen interval
    this.#bot.action(new RegExp(`^${INTERVAL_CALLBACK_PREFIX}([^:]+):(.+)$`), async ctx => {
      await ctx.answerCbQuery();

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

    const botInfo = await this.#bot.telegram.getMe();
    this.#platformInfo = {
      botAddress: `@${botInfo.username}`,
      sdkVersion: 'Telegraf',
    };

    await this.#bot.launch({dropPendingUpdates: true});

    console.log(`Telegram bot started as ${this.#platformInfo.botAddress}.`);
  }

  async stop(): Promise<void> {
    this.#bot.stop();
  }

  async sendMessage(userId: string, text: string): Promise<void> {
    const chatId = userId.replace(PLATFORM_PREFIX, '');
    try {
      await this.#bot.telegram.sendMessage(chatId, text, {parse_mode: 'MarkdownV2'});
    } catch {
      await this.#bot.telegram.sendMessage(chatId, text);
    }
  }

  get commandList(): string[] {
    return Array.from(this.#commands.keys()).map(cmd => `/${cmd}`);
  }

  get platformInfo(): PlatformInfo {
    return this.#platformInfo;
  }
}
