import Big from 'big.js';
import type {Fill} from './Broker.js';
import {OrderSide, OrderType} from './orderEnums.js';
import type {TradingPair} from './TradingPair.js';

/**
 * Snaps a price onto the instrument's tick, since a price between ticks cannot be placed.
 *
 * The direction is the caller's to choose and is never neutral: a long's exit rounds up and a
 * short's rounds down, so that rounding always costs the venue a fraction of a tick rather than
 * eating into the profit the price was solved for.
 */
export function roundToTick(price: Big, tick: Big, mode: typeof Big.roundUp | typeof Big.roundDown): Big {
  if (tick.lte(0)) {
    return price;
  }
  return price.div(tick).round(0, mode).mul(tick);
}

export interface ExitPriceInput {
  /** The currency every amount here is denominated in, used only to make errors readable. */
  currency: string;
  entryFee: Big;
  entryPrice: Big;
  /** The fee the venue quotes for closing at this notional, already in `currency`. */
  estimateExitFee: (notional: Big, price: Big) => Promise<Big>;
  isShort: boolean;
  minProfit: Big;
  size: Big;
  tick: Big;
}

export interface ExitPriceResult {
  /** A long's total outlay including its fee, or a short's proceeds net of it. */
  entryValue: Big;
  exitFee: Big;
  price: Big;
  profit: Big;
}

/**
 * The price at which closing a position finally clears `minProfit`.
 *
 * Solved for rather than divided out, because a fee is not reliably a rate — IBKR bills per share
 * with a per-order floor, so the fee at the answer is not a fixed multiple of the fee at the
 * guess. Each round prices the fee at the current candidate and moves the price to cover it,
 * which settles because a step changes the fee by less than it changes the price.
 *
 * A long paid `gross` plus its fee and has to earn that back; a short already received `gross`
 * less its fee and has to buy back for less than that. The fee moves the bar the same way in both
 * cases — against the trader — but the price runs in opposite directions.
 */
export async function solveExitPrice(input: ExitPriceInput): Promise<ExitPriceResult> {
  const {currency, entryFee, entryPrice, estimateExitFee, isShort, minProfit, size, tick} = input;

  const gross = entryPrice.mul(size);
  const entryValue = isShort ? gross.minus(entryFee) : gross.plus(entryFee);

  // Enough rounds to settle, few enough that an unusual fee curve cannot spin here forever.
  const MAX_ROUNDS = 8;
  const {exitFee, price} = isShort
    ? await solveShort({currency, entryValue, estimateExitFee, maxRounds: MAX_ROUNDS, minProfit, size, tick})
    : await solveLong({entryValue, estimateExitFee, maxRounds: MAX_ROUNDS, minProfit, size, tick});

  const exitValue = isShort ? price.mul(size).plus(exitFee) : price.mul(size).minus(exitFee);

  return {
    entryValue,
    exitFee,
    price,
    profit: isShort ? entryValue.minus(exitValue) : exitValue.minus(entryValue),
  };
}

/** The floor a long has to sell above, rounded up so rounding never gives the profit away. */
async function solveLong(input: {
  entryValue: Big;
  estimateExitFee: (notional: Big, price: Big) => Promise<Big>;
  maxRounds: number;
  minProfit: Big;
  size: Big;
  tick: Big;
}): Promise<{exitFee: Big; price: Big}> {
  const {entryValue, estimateExitFee, maxRounds, minProfit, size, tick} = input;

  // What the sale has to bring in: the entry, its fee, and the profit asked for.
  const target = entryValue.plus(minProfit);
  let price = roundToTick(target.div(size), tick, Big.roundUp);
  let exitFee = new Big(0);

  for (let round = 0; round < maxRounds; round++) {
    exitFee = await estimateExitFee(price.mul(size), price);
    const needed = roundToTick(target.plus(exitFee).div(size), tick, Big.roundUp);

    if (needed.lte(price)) {
      break;
    }

    price = needed;
  }

  return {exitFee, price};
}

/** The ceiling a short has to buy back below, rounded down for the same reason. */
async function solveShort(input: {
  currency: string;
  entryValue: Big;
  estimateExitFee: (notional: Big, price: Big) => Promise<Big>;
  maxRounds: number;
  minProfit: Big;
  size: Big;
  tick: Big;
}): Promise<{exitFee: Big; price: Big}> {
  const {currency, entryValue, estimateExitFee, maxRounds, minProfit, size, tick} = input;

  // The most the buy-back may cost, fee included.
  const budget = entryValue.minus(minProfit);

  if (budget.lte(0)) {
    throw new Error(
      `Closing this short for a profit of ${minProfit.toFixed()} ${currency} would need a price at or below zero, because the position only took in ${entryValue.toFixed()}.`
    );
  }

  let price = roundToTick(budget.div(size), tick, Big.roundDown);
  let exitFee = new Big(0);

  for (let round = 0; round < maxRounds; round++) {
    exitFee = await estimateExitFee(price.mul(size), price);

    if (price.mul(size).plus(exitFee).lte(budget)) {
      break;
    }

    /*
     * The buy-back fee has eaten the whole budget, so no price above zero closes this short for
     * the profit asked. Caught here rather than left to converge, which would otherwise hand back
     * a price of zero or less and look like an answer.
     */
    if (budget.minus(exitFee).lte(0)) {
      throw new Error(
        `Closing this short for a profit of ${minProfit.toFixed()} ${currency} is impossible: the exit fee of ${exitFee.toFixed()} alone exceeds the ${budget.toFixed()} the position has to spend.`
      );
    }

    price = roundToTick(budget.minus(exitFee).div(size), tick, Big.roundDown);
  }

  if (price.lte(0)) {
    throw new Error(
      `Closing this short for a profit of ${minProfit.toFixed()} ${currency} would need a price of ${price.toFixed()}, which cannot be placed.`
    );
  }

  return {exitFee, price};
}

export interface ResolvedEntry {
  fee: Big;
  price: Big;
  side: OrderSide;
  size: Big;
}

/**
 * The entry a target is measured against: an order already filled, whose side and fee come from
 * the execution, or a hypothetical price treated as long unless told otherwise.
 *
 * The fill's own side is what separates a long from a short. Ignoring it prices a short's exit as
 * though the position had been bought, which moves the target the wrong way entirely.
 */
export async function resolveEntry(
  pair: TradingPair,
  entry: {orderId: string} | {fee?: Big | string; price: Big | string; side?: OrderSide; size: Big | string},
  longSide: OrderSide,
  getFillByOrderId: (pair: TradingPair, orderId: string) => Promise<Fill | undefined>
): Promise<ResolvedEntry> {
  if (!('orderId' in entry)) {
    return {
      fee: new Big(entry.fee ?? 0),
      price: new Big(entry.price),
      // A position is long unless stated otherwise, which is the common case.
      side: entry.side ?? longSide,
      size: new Big(entry.size),
    };
  }

  const fill = await getFillByOrderId(pair, entry.orderId);

  if (!fill) {
    throw new Error(
      `No fill found for order "${entry.orderId}" on ${pair.asString('/')}, so its cost basis is unknown.`
    );
  }

  return {fee: new Big(fill.fee), price: new Big(fill.price), side: fill.side, size: new Big(fill.size)};
}

export type ExitPriceEntry =
  | {orderId: string}
  | {fee?: Big | string; price: Big | string; side?: OrderSide; size: Big | string};

export interface ExitPriceOptions {
  /** Multiplier from the fee currency into `pair.counter`, needed only when the two differ. */
  feeToCounterRate?: Big | string;
  minProfit?: Big | string;
  orderType?: OrderType;
}

export interface ProfitableExitPrice {
  currency: string;
  entryFee: Big;
  /** `BUY` for a long position, `SELL` for a short one. Taken from the fill when resolved by id. */
  entrySide: OrderSide;
  /** A long's total outlay including its fee, or a short's proceeds net of it. */
  entryValue: Big;
  exitFee: Big;
  /** The side that closes the position: `SELL` out of a long, `BUY` back into a short. */
  exitSide: OrderSide;
  minProfit: Big;
  price: Big;
  profit: Big;
}

/** The part of a broker this needs, kept structural so the module does not depend on the class. */
interface ExitPriceBroker {
  estimateFee(
    pair: TradingPair,
    orderType: OrderType,
    notional: Big,
    ticket?: {price?: Big; size?: Big}
  ): Promise<{total: Big}>;
  getFillByOrderId(pair: TradingPair, orderId: string): Promise<Fill | undefined>;
  getName(): string;
  getTradingRules(pair: TradingPair): Promise<{counter_increment: string}>;
}

/**
 * What an exit has to fetch to be worth taking.
 *
 * A percentage target is not a profit: on a small position the round trip can cost more than the
 * move it is measured against. One share of Ford bought at USD 11.55 cost USD 0.12 to buy and USD
 * 0.12 to sell, so a 1% take-profit at 11.78 would have realised a loss.
 *
 * Which way the bound runs depends on the position: a long needs a floor to sell above, a short a
 * ceiling to buy back below, and the entry's side decides. The entry is an order already filled,
 * with its side and fee read from the execution, or a hypothetical price treated as long unless
 * `side` says otherwise. `minProfit` defaults to one cent, the smallest amount a currency can
 * express.
 *
 * Everything is denominated in `pair.counter`, `minProfit` included. A broker that debits fees in
 * another currency (Trading212 bills a EUR account in EUR for a USD instrument) needs
 * `feeToCounterRate`; without it the sum would silently mix currencies, so the call fails instead.
 */
export async function resolveProfitableExitPrice(input: {
  broker: ExitPriceBroker;
  entry: ExitPriceEntry;
  feeAsset: string;
  options?: ExitPriceOptions | undefined;
  pair: TradingPair;
}): Promise<ProfitableExitPrice> {
  const {broker, entry, feeAsset, options, pair} = input;
  const minProfit = new Big(options?.minProfit ?? '0.01');
  const orderType = options?.orderType ?? OrderType.LIMIT;
  const currency = pair.counter;

  /*
   * A fee in another currency is not comparable with a price in `pair.counter`, and adding the two
   * would produce a confident but meaningless target. Converting needs a rate this module has no
   * way to look up, so the caller supplies one or gets an error.
   */
  if (feeAsset !== currency && options?.feeToCounterRate === undefined) {
    throw new Error(
      `${broker.getName()} debits fees in ${feeAsset} while ${pair.asString('/')} is priced in ${currency}. Pass \`feeToCounterRate\` (${feeAsset}\u2192${currency}) so the fees can be added to the price.`
    );
  }

  const feeRate = new Big(options?.feeToCounterRate ?? 1);
  const resolved = await resolveEntry(pair, entry, OrderSide.BUY, (target, orderId) =>
    broker.getFillByOrderId(target, orderId)
  );

  if (resolved.size.lte(0)) {
    throw new Error(`Cannot price an exit for a position of ${resolved.size.toFixed()} ${pair.base}.`);
  }

  const isShort = resolved.side === OrderSide.SELL;
  const rules = await broker.getTradingRules(pair);
  const entryFee = resolved.fee.mul(feeRate);

  const solved = await solveExitPrice({
    currency,
    entryFee,
    entryPrice: resolved.price,
    /*
     * The size is the position being closed and the notional is that size at the candidate
     * price, so both are known exactly. A broker billing per share needs them: handed a notional
     * alone it has to divide by some price, and the only one it has is the current quote, which
     * prices a different number of shares than the exit actually sells.
     */
    estimateExitFee: async (notional, price) =>
      (await broker.estimateFee(pair, orderType, notional, {price, size: resolved.size})).total.mul(feeRate),
    isShort,
    minProfit,
    size: resolved.size,
    tick: new Big(rules.counter_increment),
  });

  return {
    currency,
    entryFee,
    entrySide: resolved.side,
    entryValue: solved.entryValue,
    exitFee: solved.exitFee,
    exitSide: isShort ? OrderSide.BUY : OrderSide.SELL,
    minProfit,
    price: solved.price,
    profit: solved.profit,
  };
}
