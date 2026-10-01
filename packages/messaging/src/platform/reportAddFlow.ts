import type {Bot, CallbackQueryContext, Context} from 'grammy';
import {getAvailableReportNames, reportRequiresAccount} from 'trading-strategies';
import {reportAdd} from '../command/report/reportAdd.js';
import {assertInterval} from '../validation/assertInterval.js';
import {Account} from '../database/models/Account.js';
import type {ReportScheduler} from '../service/index.js';
import {replyWithMarkdown} from './telegramMarkdown.js';
import {inlineKeyboard, type InlineButton, type WizardContext} from './wizards/shared.js';

const REPORT_CALLBACK_PREFIX = 'report:';
const ACCOUNT_CALLBACK_PREFIX = 'reportaccount:';
const MODE_CALLBACK_PREFIX = 'reportmode:';
const INTERVAL_CALLBACK_PREFIX = 'reportinterval:';

interface ReportAddFlowDeps {
  authorizedUserId: (ctx: Context) => string | null;
  reportScheduler: () => ReportScheduler | undefined;
}

type ReportInputValidation = {ok: true; reportName: string} | {ok: false; message: string};

function isKnownReport(reportName: string) {
  return getAvailableReportNames().includes(reportName);
}

/**
 * Parses a `reportInput` string (`"<reportName>"` or `"<reportName> <accountId>"`)
 * extracted from a callback payload and verifies both the report name and, if
 * present, that the account belongs to the sender. Defense-in-depth against a
 * tampered callback_data that tries to run a report against someone else's
 * account or a report the bot does not expose.
 */
function validateReportInput(userId: string, reportInput: string): ReportInputValidation {
  const [reportName = '', accountIdStr] = reportInput.split(/\s+/);

  if (!isKnownReport(reportName)) {
    return {message: `Unknown report "${reportName}".`, ok: false};
  }

  if (accountIdStr !== undefined) {
    const accountId = Number.parseInt(accountIdStr, 10);
    if (!Number.isFinite(accountId) || !Account.findByUserIdAndId(userId, accountId)) {
      return {message: 'Account not found.', ok: false};
    }
  }

  return {ok: true, reportName};
}

function runModeKeyboard(reportInput: string) {
  return inlineKeyboard([
    [{callback_data: `${MODE_CALLBACK_PREFIX}once:${reportInput}`, text: 'Run once'}],
    [{callback_data: `${MODE_CALLBACK_PREFIX}schedule:${reportInput}`, text: 'Schedule recurring'}],
  ]);
}

function intervalKeyboard(reportInput: string) {
  const button = (interval: string) => ({
    callback_data: `${INTERVAL_CALLBACK_PREFIX}${interval}:${reportInput}`,
    text: interval,
  });
  return inlineKeyboard([['1m', '1h', '6h'].map(button), ['12h', '1d', '1w'].map(button)]);
}

/**
 * Registers `/reportAdd` and the inline-keyboard callbacks that walk the user
 * through report → (account) → run mode → (interval).
 */
export function registerReportAddFlow(bot: Bot<WizardContext>, deps: ReportAddFlowDeps): void {
  const onCallback = (
    pattern: RegExp,
    handler: (ctx: CallbackQueryContext<WizardContext>, userId: string) => Promise<void>
  ) => {
    bot.callbackQuery(pattern, async ctx => {
      await ctx.answerCallbackQuery();
      const userId = deps.authorizedUserId(ctx);
      if (userId) {
        await handler(ctx, userId);
      }
    });
  };

  // Step 1: list reports
  bot.command('reportadd', async ctx => {
    if (!deps.authorizedUserId(ctx)) {
      return;
    }

    const available = getAvailableReportNames();
    if (available.length === 0) {
      await ctx.reply('No reports available. Check that the required environment variables are set.');
      return;
    }

    const rows: InlineButton[][] = available.map(name => [
      {callback_data: `${REPORT_CALLBACK_PREFIX}${name}`, text: name},
    ]);
    await ctx.reply('Select a report to run:', inlineKeyboard(rows));
  });

  // Step 2: User selected a report — if it needs an account, ask for one; otherwise ask run mode
  onCallback(new RegExp(`^${REPORT_CALLBACK_PREFIX}(.+)$`), async (ctx, userId) => {
    const reportName = ctx.match[1];
    if (!isKnownReport(reportName)) {
      await ctx.editMessageText(`Unknown report "${reportName}".`);
      return;
    }

    if (!reportRequiresAccount(reportName)) {
      await ctx.editMessageText(`Report: ${reportName}\nRun once or schedule recurring?`, runModeKeyboard(reportName));
      return;
    }

    const userAccounts = Account.findByUserId(userId);
    if (userAccounts.length === 0) {
      await ctx.editMessageText(
        `Report "${reportName}" requires an exchange account.\nUse /accountAdd to add one first.`
      );
      return;
    }

    const rows: InlineButton[][] = userAccounts.map(acc => [
      {
        callback_data: `${ACCOUNT_CALLBACK_PREFIX}${acc.id}:${reportName}`,
        text: `${acc.name} (${acc.exchange}${acc.isPaper ? ' paper' : ''})`,
      },
    ]);
    await ctx.editMessageText(`Report: ${reportName}\nSelect an account:`, inlineKeyboard(rows));
  });

  // Step 2b: User selected an account — ask run mode
  onCallback(new RegExp(`^${ACCOUNT_CALLBACK_PREFIX}(\\d+):(.+)$`), async (ctx, userId) => {
    const accountId = ctx.match[1];
    const reportName = ctx.match[2];
    // Carry accountId through by appending it to the reportName in the callback data
    const reportInput = `${reportName} ${accountId}`;

    const validation = validateReportInput(userId, reportInput);
    if (!validation.ok) {
      await ctx.editMessageText(validation.message);
      return;
    }

    await ctx.editMessageText(
      `Report: ${reportName} (account ${accountId})\nRun once or schedule recurring?`,
      runModeKeyboard(reportInput)
    );
  });

  // Step 3a: Run once
  onCallback(new RegExp(`^${MODE_CALLBACK_PREFIX}once:(.+)$`), async (ctx, userId) => {
    const reportInput = ctx.match[1];
    const validation = validateReportInput(userId, reportInput);
    if (!validation.ok) {
      await ctx.editMessageText(validation.message);
      return;
    }

    await ctx.editMessageText(`Running report: ${validation.reportName}...`);
    const result = await reportAdd(reportInput, userId);
    await replyWithMarkdown(ctx, result.message);
  });

  // Step 3b: Schedule — ask for interval
  onCallback(new RegExp(`^${MODE_CALLBACK_PREFIX}schedule:(.+)$`), async (ctx, userId) => {
    const reportInput = ctx.match[1];
    const validation = validateReportInput(userId, reportInput);
    if (!validation.ok) {
      await ctx.editMessageText(validation.message);
      return;
    }

    await ctx.editMessageText(`Report: ${validation.reportName}\nSelect interval:`, intervalKeyboard(reportInput));
  });

  // Step 4: Schedule with chosen interval
  onCallback(new RegExp(`^${INTERVAL_CALLBACK_PREFIX}([^:]+):(.+)$`), async (ctx, userId) => {
    const interval = ctx.match[1];
    const reportInput = ctx.match[2];
    const validation = validateReportInput(userId, reportInput);
    if (!validation.ok) {
      await ctx.editMessageText(validation.message);
      return;
    }

    let intervalMs: number;
    try {
      intervalMs = assertInterval(interval);
    } catch {
      await ctx.editMessageText(`Invalid interval "${interval}". Please select one of: 1m, 1h, 6h, 12h, 1d, 1w.`);
      return;
    }

    await ctx.editMessageText(`Scheduling report: ${validation.reportName} every ${interval}...`);
    const result = await reportAdd(reportInput, userId, {intervalMs});
    await replyWithMarkdown(ctx, result.message);

    const scheduler = deps.reportScheduler();
    if (result.report?.intervalMs && scheduler) {
      scheduler.scheduleReport(result.report, {runImmediately: true});
    }
  });
}
