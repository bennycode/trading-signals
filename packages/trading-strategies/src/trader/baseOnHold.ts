import Big from 'big.js';
import {OrderSide} from '@typedtrader/exchange';
import type {PendingOrder} from '@typedtrader/exchange';

/**
 * Base currency that unfilled sell orders are holding. An exchange keeps it out of the available
 * balance, so a strategy that reads its position off that balance alone sees its own resting order
 * as a position someone else sold — and a strategy that acts on that will enter a second time and
 * leave the first order to fill later on its own.
 *
 * A sell denominated in counter currency ("get me 200 USD worth") names no quantity, so it
 * contributes nothing countable here.
 */
export function baseOnHold(openOrders: readonly PendingOrder[]): Big {
  return openOrders
    .filter(order => order.side === OrderSide.SELL && !('sizeInCounter' in order && order.sizeInCounter))
    .reduce((total, order) => total.plus(order.size), new Big(0));
}
