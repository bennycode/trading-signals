import type {Context} from 'grammy';
import {z} from 'zod';
import {OrderSide, TradingPair} from '@typedtrader/exchange';
import {getAccountBrokerClient} from '../../broker/getAccountBrokerClient.js';
import {placeOrder} from '../../command/placeOrder.js';
import {Account} from '../../database/models/Account.js';
import {inlineKeyboard, type InlineButton, type WizardContext, type WizardConversation} from './shared.js';

export const TRADE_WIZARD_ID = 'trade';

/*
 * Display (camelCase) names shown in `/help` and usage errors. grammY
 * registration uses the lowercased form so command matching stays
 * case-insensitive via the middleware installed in the constructor.
 */
export const TRADE_COMMAND_NAMES = ['buyMarket', 'sellMarket', 'buyLimit', 'sellLimit'] as const;
export type TradeCommandName = (typeof TRADE_COMMAND_NAMES)[number];

interface TradeCommandShape {
  side: OrderSide;
  isLimit: boolean;
}

function tradeCommandShape(name: TradeCommandName): TradeCommandShape {
  switch (name) {
    case 'buyMarket':
      return {isLimit: false, side: OrderSide.BUY};
    case 'sellMarket':
      return {isLimit: false, side: OrderSide.SELL};
    case 'buyLimit':
      return {isLimit: true, side: OrderSide.BUY};
    case 'sellLimit':
      return {isLimit: true, side: OrderSide.SELL};
  }
}

function buildTradeActionLabel(cmd: TradeCommandName, pair: TradingPair, quantity: string, limitPrice?: string) {
  const {isLimit, side} = tradeCommandShape(cmd);
  const sideLabel = side === OrderSide.BUY ? 'BUY' : 'SELL';
  const kindLabel = isLimit ? 'LIMIT' : 'MARKET';
  if (isLimit && limitPrice !== undefined) {
    return `${kindLabel} ${sideLabel} ${quantity} ${pair.base} @ ${limitPrice} ${pair.counter}`;
  }
  return `${kindLabel} ${sideLabel} ${quantity} ${pair.base}`;
}

const positiveNumber = z.coerce.number().positive().finite();

export interface TradeArgs {
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
export async function parseTradeCommandInput(ctx: Context, cmd: TradeCommandName): Promise<TradeArgs | null> {
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

  if (!isLimit) {
    return {cmd, pairStr, quantity: String(quantityCheck.data)};
  }

  const priceCheck = positiveNumber.safeParse(priceInput);
  if (!priceCheck.success) {
    await ctx.reply(`Invalid price "${priceInput}". Must be a positive number.`);
    return null;
  }

  return {cmd, limitPrice: String(priceCheck.data), pairStr, quantity: String(quantityCheck.data)};
}

/**
 * The full trade wizard, expressed as a linear async function. Each `await`
 * detaches and resumes when the user clicks the next button — the plugin
 * handles state and routing for us. No `callback_data` encoding, no manual
 * dispatcher, no step-state machine.
 */
export async function tradeWizard(
  conversation: WizardConversation,
  ctx: WizardContext,
  args: TradeArgs & {userId: string}
): Promise<void> {
  const {userId} = args;

  /*
   * Account lookup touches the database — wrap it in `external` so the
   * conversations engine records the value in the replay log instead of
   * re-executing the query on every resume. Only return the fields needed
   * for the picker so sensitive credentials are not persisted in replay state.
   */
  const accounts = await conversation.external(() =>
    Account.findByUserId(userId).map(acc => ({
      exchange: acc.exchange,
      id: acc.id,
      isPaper: acc.isPaper,
      name: acc.name,
    }))
  );

  if (accounts.length === 0) {
    await ctx.reply('No exchange account found. Use /accountAdd to add one first.');
    return;
  }

  const pair = TradingPair.fromString(args.pairStr, ',');
  const actionLabel = buildTradeActionLabel(args.cmd, pair, args.quantity, args.limitPrice);

  // Step 1: account picker
  const accountButtons: InlineButton[][] = accounts.map(acc => [
    {
      callback_data: `trade:acc:${acc.id}`,
      text: `${acc.name} (${acc.exchange}${acc.isPaper ? ' paper' : ''})`,
    },
  ]);
  await ctx.reply(`${actionLabel}\nSelect an account:`, inlineKeyboard(accountButtons));

  const accountSelection = await conversation.waitForCallbackQuery(accounts.map(acc => `trade:acc:${acc.id}`));
  /*
   * `match` is `string | RegExpMatchArray` in the type system, but since we
   * only pass literal strings as triggers it's always a string at runtime.
   */
  const selectedData = typeof accountSelection.match === 'string' ? accountSelection.match : '';
  const accountId = Number.parseInt(selectedData.split(':')[2] ?? '', 10);

  // Step 2: fetch price context + show confirmation
  const confirmation = await conversation.external(() => buildTradeConfirmation(userId, args, pair, accountId));
  await accountSelection.answerCallbackQuery();
  await accountSelection.editMessageText(confirmation.text, confirmation.keyboard);

  // Step 3: wait for Yes / No
  const decision = await conversation.waitForCallbackQuery(['trade:cnf:y', 'trade:cnf:n']);
  await decision.answerCallbackQuery();
  if (decision.match === 'trade:cnf:n') {
    await decision.editMessageText('Cancelled.');
    return;
  }

  // Step 4: execute
  await decision.editMessageText('Placing order…');
  const result = await conversation.external(() =>
    placeOrder({
      accountId,
      limitPrice: args.limitPrice,
      pair,
      quantity: args.quantity,
      side: tradeCommandShape(args.cmd).side,
      userId,
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
      keyboard: inlineKeyboard([]),
      text: `Account "${accountId}" not found. Run the command again.`,
    };
  }

  const actionLabel = buildTradeActionLabel(args.cmd, pair, args.quantity, args.limitPrice);

  /*
   * Fetch current price as confirmation context. Failure is non-fatal —
   * the user still sees the action and can confirm without the price hint.
   */
  let priceContext = '';
  try {
    const client = getAccountBrokerClient(account);
    const candle = await client.getLatestCandle(pair, client.getSmallestInterval());
    priceContext = `\nCurrent ~${candle.close} ${pair.counter}`;
  } catch {
    // Ignore — price context is best-effort.
  }

  const text = `${actionLabel}\nAccount: ${account.name}${priceContext}\n\nProceed?`;
  const keyboard = inlineKeyboard([
    [
      {callback_data: 'trade:cnf:y', text: '✓ Yes, place order'},
      {callback_data: 'trade:cnf:n', text: '✗ Cancel'},
    ],
  ]);

  return {keyboard, text};
}
