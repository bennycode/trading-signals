import {TradingPair} from '@typedtrader/exchange';
import {createStrategy, getStrategyNames} from 'trading-strategies';
import {Account} from '../../database/models/Account.js';
import {Strategy} from '../../database/models/Strategy.js';
import {logger} from '../../logger.js';
import type {StrategyMonitor} from '../../service/index.js';
import {inlineKeyboard, type InlineButton, type WizardContext, type WizardConversation} from './shared.js';

export interface StrategyAddWizardArgs {
  userId: string;
}

export function makeStrategyAddWizard(deps: {strategyMonitor: () => StrategyMonitor | undefined}) {
  return async function strategyAddWizard(
    conversation: WizardConversation,
    ctx: WizardContext,
    args: StrategyAddWizardArgs
  ): Promise<void> {
    const strategies = getStrategyNames();
    if (strategies.length === 0) {
      await ctx.reply('No strategies available.');
      return;
    }

    const strategyButtons: InlineButton[][] = strategies.map(name => [
      {text: name, callback_data: `strategyadd:strat:${name}`},
    ]);
    await ctx.reply('Pick a strategy:', inlineKeyboard(strategyButtons));

    const stratCb = await conversation.waitForCallbackQuery(strategies.map(n => `strategyadd:strat:${n}`));
    await stratCb.answerCallbackQuery();
    const strategyName = typeof stratCb.match === 'string' ? stratCb.match.replace('strategyadd:strat:', '') : '';

    const accounts = await conversation.external(() =>
      Account.findByUserId(args.userId).map(a => ({id: a.id, name: a.name, exchange: a.exchange, isPaper: a.isPaper}))
    );
    if (accounts.length === 0) {
      await stratCb.editMessageText(`Strategy: ${strategyName}\nNo account found. Use /accountAdd first.`);
      return;
    }

    const accountButtons: InlineButton[][] = accounts.map(a => [
      {text: `${a.name} (${a.exchange}${a.isPaper ? ' paper' : ''})`, callback_data: `strategyadd:acc:${a.id}`},
    ]);
    await stratCb.editMessageText(`Strategy: ${strategyName}\nPick an account:`, inlineKeyboard(accountButtons));

    const accountCb = await conversation.waitForCallbackQuery(accounts.map(a => `strategyadd:acc:${a.id}`));
    await accountCb.answerCallbackQuery();
    const accountId = Number.parseInt(typeof accountCb.match === 'string' ? accountCb.match.split(':')[2] : '', 10);
    const selectedAccount = accounts.find(a => a.id === accountId);
    const accountLabel = selectedAccount ? selectedAccount.name : `#${accountId}`;

    await accountCb.editMessageText(
      `Strategy: ${strategyName}\nAccount: ${accountLabel}\n\nSend a trading pair (e.g. SHOP,USD):`
    );
    const pairCtx = await conversation.waitFor('message:text');
    const pairStr = pairCtx.msg.text.trim();
    try {
      TradingPair.fromString(pairStr, ',');
    } catch {
      await ctx.reply(`Invalid pair "${pairStr}". Use BASE,COUNTER format. Aborted.`);
      return;
    }

    await ctx.reply('Send config as JSON (or "{}" for defaults):');
    const cfgCtx = await conversation.waitFor('message:text');
    const configJson = cfgCtx.msg.text.trim() || '{}';

    let config: unknown;
    try {
      config = JSON.parse(configJson);
    } catch {
      await ctx.reply(`Invalid JSON "${configJson}". Aborted.`);
      return;
    }

    const result = await conversation.external(async () => {
      try {
        const account = Account.findByPk(accountId);
        if (!account || account.userId !== args.userId) {
          return {ok: false as const, error: 'Account not found.'};
        }
        createStrategy(strategyName, config);
        const row = Strategy.create({
          accountId,
          strategyName,
          config: configJson,
          pair: pairStr,
        });
        return {ok: true as const, strategy: row, accountName: account.name};
      } catch (error) {
        logger.error({err: error}, 'strategyAdd wizard failed');
        return {ok: false as const, error: error instanceof Error ? error.message : 'Unknown error'};
      }
    });

    if (!result.ok) {
      await ctx.reply(`Error creating strategy: ${result.error}`);
      return;
    }

    await ctx.reply(
      `Strategy created (ID: ${result.strategy.id})\nStrategy: ${strategyName}\nPair: ${pairStr}\nAccount: ${result.accountName}`
    );

    const strategyMonitor = deps.strategyMonitor();
    if (strategyMonitor) {
      try {
        await conversation.external(() => strategyMonitor.subscribeToStrategy(result.strategy));
      } catch (error) {
        logger.error({err: error}, 'Error starting strategy');
      }
    }
  };
}
