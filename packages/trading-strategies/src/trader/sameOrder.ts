import Big from 'big.js';
import {AllAvailableAmount} from './TradingSessionTypes.js';
import type {OrderAdvice} from './TradingSessionTypes.js';

function sameAmount(one: OrderAdvice['amount'], other: OrderAdvice['amount']): boolean {
  if (one === AllAvailableAmount || other === AllAvailableAmount) {
    return one === other;
  }
  return new Big(one).eq(new Big(other));
}

function limitOf(advice: OrderAdvice): Big | null {
  return 'price' in advice ? new Big(advice.price) : null;
}

function samePrice(one: OrderAdvice, other: OrderAdvice): boolean {
  const oneLimit = limitOf(one);
  const otherLimit = limitOf(other);
  if (!oneLimit || !otherLimit) {
    return oneLimit === otherLimit;
  }
  return oneLimit.eq(otherLimit);
}

/**
 * Whether two pieces of advice ask the exchange for the same thing. The reason behind them is left
 * out on purpose: a rule may word itself differently from one candle to the next while still
 * asking for the order that is already working.
 */
export function sameOrder(one: OrderAdvice, other: OrderAdvice): boolean {
  return (
    one.side === other.side &&
    one.type === other.type &&
    one.amountIn === other.amountIn &&
    sameAmount(one.amount, other.amount) &&
    samePrice(one, other)
  );
}
