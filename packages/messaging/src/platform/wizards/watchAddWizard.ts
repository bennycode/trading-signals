import Big from 'big.js';
import {ms} from 'ms';
import {TradingPair, getExchangeClient} from '@typedtrader/exchange';
import {Account} from '../../database/models/Account.js';
import {Watch} from '../../database/models/Watch.js';
import {assertInterval} from '../../validation/assertInterval.js';
import {parseThreshold} from '../../validation/parseThreshold.js';
import {logger} from '../../logger.js';
import type {WatchMonitor} from '../../service/index.js';
import {inlineKeyboard, type InlineButton, type WizardContext, type WizardConversation} from './shared.js';

export interface WatchAddWizardArgs {
  userId: string;
}

const INTERVALS = ['1m', '5m', '15m', '1h', '6h', '12h', '1d'] as const;

export function makeWatchAddWizard(deps: {watchMonitor: () => WatchMonitor | undefined}) {
  return async function watchAddWizard(
    conversation: WizardConversation,
    ctx: WizardContext,
    args: WatchAddWizardArgs
  ): Promise<void> {
    const accounts = await conversation.external(() =>
      Account.findByUserId(args.userId).map(a => ({id: a.id, name: a.name, exchange: a.exchange, isPaper: a.isPaper}))
    );
    if (accounts.length === 0) {
      await ctx.reply('No account found. Use /accountAdd first.');
      return;
    }

    const accountButtons: InlineButton[][] = accounts.map(a => [
      {text: `${a.name} (${a.exchange}${a.isPaper ? ' paper' : ''})`, callback_data: `watchadd:acc:${a.id}`},
    ]);
    await ctx.reply('Pick an account:', inlineKeyboard(accountButtons));

    const accountCb = await conversation.waitForCallbackQuery(accounts.map(a => `watchadd:acc:${a.id}`));
    await accountCb.answerCallbackQuery();
    const accountId = Number.parseInt(typeof accountCb.match === 'string' ? accountCb.match.split(':')[2] : '', 10);

    await accountCb.editMessageText('Send a trading pair (e.g. SHOP,USD):');
    const pairCtx = await conversation.waitFor('message:text');
    const pairStr = pairCtx.msg.text.trim();
    let pair: TradingPair;
    try {
      pair = TradingPair.fromString(pairStr, ',');
    } catch {
      await ctx.reply(`Invalid pair "${pairStr}". Use BASE,COUNTER format. Aborted.`);
      return;
    }

    await ctx.reply(
      `Pair: ${pairStr}\nSelect check interval:`,
      inlineKeyboard([
        INTERVALS.slice(0, 4).map(i => ({text: i, callback_data: `watchadd:int:${i}`})),
        INTERVALS.slice(4).map(i => ({text: i, callback_data: `watchadd:int:${i}`})),
      ])
    );
    const intervalCb = await conversation.waitForCallbackQuery(INTERVALS.map(i => `watchadd:int:${i}`));
    await intervalCb.answerCallbackQuery();
    const interval = typeof intervalCb.match === 'string' ? intervalCb.match.split(':')[2] : INTERVALS[0];

    await intervalCb.editMessageText(
      `Pair: ${pairStr}\nInterval: ${interval}\nAlert direction:`,
      inlineKeyboard([
        [
          {text: '⬆️ Up', callback_data: 'watchadd:dir:up'},
          {text: '⬇️ Down', callback_data: 'watchadd:dir:down'},
        ],
      ])
    );
    const directionCb = await conversation.waitForCallbackQuery(['watchadd:dir:up', 'watchadd:dir:down']);
    await directionCb.answerCallbackQuery();
    const direction: 'up' | 'down' = directionCb.match === 'watchadd:dir:up' ? 'up' : 'down';

    await directionCb.editMessageText(
      `Pair: ${pairStr}\nInterval: ${interval}\nDirection: ${direction}\nThreshold type:`,
      inlineKeyboard([
        [
          {text: '% Percent', callback_data: 'watchadd:type:percent'},
          {text: '# Absolute', callback_data: 'watchadd:type:absolute'},
        ],
      ])
    );
    const typeCb = await conversation.waitForCallbackQuery(['watchadd:type:percent', 'watchadd:type:absolute']);
    await typeCb.answerCallbackQuery();
    const thresholdType: 'percent' | 'absolute' = typeCb.match === 'watchadd:type:percent' ? 'percent' : 'absolute';

    await typeCb.editMessageText(
      `Pair: ${pairStr}\nInterval: ${interval}\nDirection: ${direction}\nType: ${thresholdType}\n\nSend the threshold value (e.g. 5 for 5%):`
    );
    const valueCtx = await conversation.waitFor('message:text');
    const valueStr = valueCtx.msg.text.trim();
    const thresholdInput = `${direction === 'up' ? '+' : '-'}${valueStr}${thresholdType === 'percent' ? '%' : ''}`;
    const threshold = parseThreshold(thresholdInput);
    if (!threshold) {
      await ctx.reply(`Invalid threshold value "${valueStr}". Aborted.`);
      return;
    }

    await ctx.reply('Creating watch…');

    const result = await conversation.external(async () => {
      try {
        const account = Account.findByPk(accountId);
        if (!account || account.userId !== args.userId) {
          return {ok: false as const, error: 'Account not found.'};
        }
        const client = getExchangeClient({
          exchangeId: account.exchange,
          apiKey: account.apiKey,
          apiSecret: account.apiSecret,
          isPaper: account.isPaper,
        });
        const smallestInterval = client.getSmallestInterval();
        const intervalMs = assertInterval(interval);
        if (intervalMs < smallestInterval) {
          return {
            ok: false as const,
            error: `Minimum interval for ${account.exchange} is ${ms(smallestInterval, {long: true})}.`,
          };
        }
        const candle = await client.getLatestCandle(pair, smallestInterval);
        const baselinePrice = candle.close;
        const multiplier = new Big(direction === 'up' ? 1 : -1);
        const alertPrice =
          threshold.type === 'percent'
            ? new Big(baselinePrice).times(new Big(1).plus(multiplier.times(threshold.value).div(100)))
            : new Big(baselinePrice).plus(multiplier.times(threshold.value));
        const watch = Watch.create({
          accountId,
          pair: pairStr,
          intervalMs,
          thresholdType: threshold.type,
          thresholdDirection: threshold.direction,
          thresholdValue: threshold.value.toString(),
          baselinePrice: baselinePrice.toString(),
          alertPrice: alertPrice.toString(),
        });
        return {ok: true as const, watch, baselinePrice, alertPrice: alertPrice.toString(), counter: pair.counter};
      } catch (error) {
        logger.error({err: error}, 'watchAdd wizard failed');
        return {ok: false as const, error: error instanceof Error ? error.message : 'Unknown error'};
      }
    });

    if (!result.ok) {
      await ctx.reply(`Error creating watch: ${result.error}`);
      return;
    }

    const displayThreshold =
      threshold.type === 'percent'
        ? `${direction === 'up' ? '+' : '-'}${threshold.value}%`
        : `${direction === 'up' ? '+' : '-'}${threshold.value} ${result.counter}`;
    await ctx.reply(
      `Watch created (ID: ${result.watch.id})\nPair: ${pairStr}\nBaseline: ${result.baselinePrice} ${result.counter}\nAlert when: ${displayThreshold} (${result.alertPrice} ${result.counter})\nCheck every: ${interval}`
    );

    const watchMonitor = deps.watchMonitor();
    if (watchMonitor) {
      try {
        await conversation.external(() => watchMonitor.subscribeToWatch(result.watch));
      } catch (error) {
        logger.error({err: error}, 'Error subscribing to new watch');
      }
    }
  };
}
