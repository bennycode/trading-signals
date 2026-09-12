import {setTimeout as sleep} from 'node:timers/promises';
import Big from 'big.js';
import {type Broker, type OrderSide, OrderType} from '../broker/Broker.js';
import type {MarketDataSource} from '../broker/MarketDataSource.js';
import type {TradingPair} from '../broker/TradingPair.js';

export async function placeCliOrder(
  broker: Broker & MarketDataSource,
  pair: TradingPair,
  order: {side: OrderSide; size: string; limit?: string; dryRun?: boolean}
) {
  const {side, size, limit, dryRun} = order;
  if (dryRun) {
    return previewOrder(broker, pair, side, size, limit);
  }
  return limit
    ? broker.placeLimitOrder(pair, {price: limit, side, size})
    : broker.placeMarketOrder(pair, {side, size, sizeInCounter: false});
}

async function previewOrder(
  broker: Broker & MarketDataSource,
  pair: TradingPair,
  side: OrderSide,
  size: string,
  limit?: string
) {
  const quantity = new Big(size);
  const rules = await broker.getTradingRules(pair);
  if (quantity.lt(rules.base_min_size) || quantity.gt(rules.base_max_size)) {
    throw new Error(`Quantity must be between ${rules.base_min_size} and ${rules.base_max_size}.`);
  }
  if (new Big(rules.base_increment).gt(0) && !quantity.mod(rules.base_increment).eq(0)) {
    throw new Error(`Quantity must be a multiple of ${rules.base_increment}.`);
  }
  const price = limit
    ? new Big(limit)
    : new Big((await broker.getLatestCandle(pair, broker.getSmallestInterval())).close);
  if (limit && new Big(rules.counter_increment).gt(0) && !price.mod(rules.counter_increment).eq(0)) {
    throw new Error(`Limit price must be a multiple of ${rules.counter_increment}.`);
  }
  const notional = price.times(quantity);
  if (notional.lt(rules.counter_min_size)) {
    throw new Error(`Order value must be at least ${rules.counter_min_size} ${pair.counter}.`);
  }
  return {
    dryRun: true,
    estimatedFee: await broker.estimateFee(pair, limit ? OrderType.LIMIT : OrderType.MARKET, notional),
    estimatedNotional: notional,
    order: {pair, price: limit, side, size, type: limit ? OrderType.LIMIT : OrderType.MARKET},
    rules,
  };
}

export async function waitForOrder(broker: Broker, pair: TradingPair, id: string, timeout: number, poll: number) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const fill = await broker.getFillByOrderId(pair, id);
    if (fill) {
      return {fill, status: 'FILLED'};
    }
    const open = (await broker.getOpenOrders(pair)).some(order => order.id === id);
    if (!open) {
      // Account for a fill arriving between the fill and open-order requests.
      const lateFill = await broker.getFillByOrderId(pair, id);
      if (lateFill) {
        return {fill: lateFill, status: 'FILLED'};
      }
      throw new Error(`Order ${id} is no longer open and has no fill (cancelled or rejected).`);
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`Order ${id} is still open after ${timeout}ms. The timeout does not cancel it.`);
    }
    await sleep(Math.min(poll, remaining));
  }
}
