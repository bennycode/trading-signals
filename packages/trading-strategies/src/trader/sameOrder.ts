import Big from 'big.js';
import type {BigSource} from 'big.js';
import {OrderSide} from '@typedtrader/exchange';
import type {PendingOrder, TradingRules} from '@typedtrader/exchange';
import {applyPrecision} from './applyPrecision.js';
import {AllAvailableAmount} from './TradingSessionTypes.js';
import type {OrderAdvice} from './TradingSessionTypes.js';

function limitOf(advice: OrderAdvice, rules: TradingRules): Big | null {
  // Compared as the exchange would hold it: a price is placed rounded to its increment.
  return 'price' in advice ? applyPrecision(new Big(advice.price), rules.counter_increment) : null;
}

function samePrice(advice: OrderAdvice, order: PendingOrder, rules: TradingRules): boolean {
  const wanted = limitOf(advice, rules);
  const offered = 'price' in order && order.price !== undefined ? new Big(order.price) : null;
  if (!wanted || !offered) {
    return wanted === offered;
  }
  return wanted.eq(offered);
}

/**
 * What the advice actually went to the book as. A sell is never offered above the holding, so a
 * rule asking for more than is owned has an order for the holding instead, and comparing it
 * against the rule's own number would find a difference in every candle it rests through.
 */
function cappedByHolding(advice: OrderAdvice, amount: BigSource, ownedBase: Big): Big {
  const requested = new Big(amount);
  if (advice.side !== OrderSide.SELL || advice.amountIn !== 'base') {
    return requested;
  }
  return requested.gt(ownedBase) ? ownedBase : requested;
}

/**
 * Whether the order already on the book is the one this advice asks for, in which case replacing
 * it would only cost it its place in the exchange's queue.
 *
 * Both sides are compared as the exchange holds them: a rule's price and size go through the same
 * rounding on the way to the book, so comparing what was written against what was placed would
 * find a difference in every unchanged order.
 *
 * `'all'` is the interesting case, because it names no quantity:
 *
 * - Selling all of something means the position, which changes as the position does. It is the
 *   same order only while the quantity resting on the book is still everything there is to sell.
 * - Buying with everything means the cash, and the resting order has already taken that cash out
 *   of the balance. There is nothing left to compare it against, so an unchanged price is what
 *   makes it the same order.
 */
export function sameOrder(
  advice: OrderAdvice,
  order: PendingOrder,
  context: {ownedBase: Big; rules: TradingRules}
): boolean {
  const {ownedBase, rules} = context;

  if (advice.side !== order.side || advice.type !== order.type || !samePrice(advice, order, rules)) {
    return false;
  }

  /*
   * The same number means different things in each currency: "1" of base is a quantity, "1" of
   * counter is an amount of cash to raise or spend.
   */
  const orderIsInCounter = 'sizeInCounter' in order && order.sizeInCounter === true;
  if (orderIsInCounter !== (advice.amountIn === 'counter')) {
    return false;
  }

  if (advice.amount === AllAvailableAmount) {
    return advice.side === OrderSide.SELL
      ? applyPrecision(ownedBase, rules.base_increment).eq(new Big(order.size))
      : true;
  }

  const increment = advice.amountIn === 'base' ? rules.base_increment : rules.counter_increment;
  return applyPrecision(cappedByHolding(advice, advice.amount, ownedBase), increment).eq(new Big(order.size));
}
