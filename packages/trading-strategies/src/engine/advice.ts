import Big from 'big.js';
import {OrderSide, OrderType} from '@typedtrader/exchange';
import {AllAvailableAmount} from '../trader/index.js';
import type {OrderAdvice} from '../trader/index.js';
import type {Amount, CloseRule, OpenRule} from './types.js';

/** `'all'` reaches the executor as a sentinel; anything else is a concrete size. */
function toAmount(value: Amount): Big | typeof AllAvailableAmount {
  return value === 'all' ? AllAvailableAmount : new Big(value);
}

/**
 * The order a matched rule asks for. A rule states what it wants in its own terms — a limit price
 * or none, cash to spend or a quantity to move — and this is where that becomes one order.
 */
export function adviceFor(
  side: OrderSide,
  sizing: Amount,
  price: string | null,
  because: string,
  spending = false
): OrderAdvice {
  if (price !== null) {
    const limitPrice = new Big(price);
    /*
     * A limit order is always denominated in base (see `LimitOrderAdvice`), so a `spend`
     * written on the rule is converted at the limit price we are about to offer.
     */
    const amount = spending && sizing !== 'all' ? new Big(sizing).div(limitPrice) : toAmount(sizing);
    return {amount, amountIn: 'base', price: limitPrice, reason: because, side, type: OrderType.LIMIT};
  }

  if (side === OrderSide.BUY && spending) {
    return {
      amount: toAmount(sizing),
      amountIn: 'counter',
      reason: because,
      side: OrderSide.BUY,
      type: OrderType.MARKET,
    };
  }

  if (side === OrderSide.BUY) {
    // A base-denominated market buy needs an explicit quantity, which `OpenRule` enforces.
    return {
      amount: new Big(sizing === 'all' ? 0 : sizing),
      amountIn: 'base',
      reason: because,
      side: OrderSide.BUY,
      type: OrderType.MARKET,
    };
  }

  return {
    amount: toAmount(sizing),
    amountIn: 'base',
    reason: because,
    side: OrderSide.SELL,
    type: OrderType.MARKET,
  };
}

/**
 * What a matched rule asks for, read off the rule itself: its reason, its limit price if it named
 * one, and its size, whichever way it was written. `final` says the exit ends the strategy, which
 * the engine has to remember so it can re-place the order until the position is actually gone.
 */
export function plannedOrder<F>(
  rule: OpenRule<F> | CloseRule<F>,
  facts: F,
  side: OrderSide
): {advice: OrderAdvice; because: string; final: boolean; price: string | null; quantity: string | null} {
  const because = typeof rule.because === 'string' ? rule.because : rule.because(facts);
  const limit = rule.limit?.(facts) ?? null;
  const written = 'spend' in rule && rule.spend !== undefined ? rule.spend : (rule.quantity ?? 'all');
  const sizing = typeof written === 'function' ? written(facts) : written;
  const spending = side === OrderSide.BUY && 'spend' in rule && rule.spend !== undefined;
  const price = limit ? limit.toFixed() : null;

  return {
    advice: adviceFor(side, sizing, price, because, spending),
    because,
    final: 'then' in rule && rule.then === 'finish',
    price,
    quantity: sizing === 'all' ? null : new Big(sizing).toFixed(),
  };
}
