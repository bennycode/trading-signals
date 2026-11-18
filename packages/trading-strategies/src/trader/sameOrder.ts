import Big from 'big.js';
import {AllAvailableAmount} from './TradingSessionTypes.js';
import type {OrderAdvice} from './TradingSessionTypes.js';
import type {PendingOrder} from '@typedtrader/exchange';

function limitOf(advice: OrderAdvice): Big | null {
  return 'price' in advice ? new Big(advice.price) : null;
}

function samePrice(advice: OrderAdvice, order: PendingOrder): boolean {
  const wanted = limitOf(advice);
  const offered = 'price' in order && order.price !== undefined ? new Big(order.price) : null;
  if (!wanted || !offered) {
    return wanted === offered;
  }
  return wanted.eq(offered);
}

/**
 * Whether the order already on the book is the one this advice asks for, in which case replacing
 * it would only cost it its place in the exchange's queue.
 *
 * `'all'` is the interesting case: it names no quantity, so the same words can mean a different
 * order once the balance has moved. It counts as the same order only while the quantity resting
 * on the book is still everything there is to sell.
 */
export function sameOrder(advice: OrderAdvice, order: PendingOrder, ownedBase: Big): boolean {
  if (advice.side !== order.side || advice.type !== order.type || !samePrice(advice, order)) {
    return false;
  }

  if (advice.amount === AllAvailableAmount) {
    // A cash amount cannot be compared against a quantity, so it is never read as unchanged.
    return advice.amountIn === 'base' && new Big(order.size).eq(ownedBase);
  }

  return advice.amountIn === 'base' && new Big(advice.amount).eq(new Big(order.size));
}
