import Big from 'big.js';
import {randomUUID} from 'node:crypto';
import type {Fill} from '../Broker.js';
import {TradingPair} from '../TradingPair.js';
import type {IbkrAPI} from './api/IbkrAPI.js';
import type {IbkrTrade} from './api/schema/TradeSchema.js';
import {IbkrBrokerMapper} from './IbkrBrokerMapper.js';

/**
 * What makes one execution distinct from the next, so a re-poll of the same trade is not reported
 * twice.
 *
 * `execution_id` is IBKR's own unique key and is used whenever it is present. It is nullable in
 * the schema, though, and `order_id` is absent on anything not placed through the API, so the
 * fallback has to stand on the rest of the payload. Everything that distinguishes two executions
 * goes into it: a pair of them agreeing on conid, side, size, price, value and timestamp is
 * indistinguishable from a duplicate at this layer anyway.
 *
 * ponytail: a partial fill that IBKR splits into two identical executions in the same millisecond
 * would still collapse into one. Only `execution_id` can tell those apart, so the way out is a
 * feed that reports it, not a cleverer key.
 */
export function toExecutionKey(trade: IbkrTrade): string {
  if (trade.execution_id) {
    return trade.execution_id;
  }

  return JSON.stringify([
    trade.order_id,
    trade.trade_time_r ?? trade.trade_time,
    trade.conid,
    trade.side,
    trade.size,
    trade.price,
    trade.net_amount,
  ]);
}

/**
 * Merges the executions of one order into the single fill a strategy expects: summed size and
 * commission, quantity-weighted average price.
 *
 * The timestamp is the earliest execution's, which is when the order started filling, and is
 * found by comparing the timestamps rather than by taking an end of the array. The two callers
 * hand their executions over in opposite orders — the watcher in whatever order the trades feed
 * returned them, {@link IbkrBroker.getFillByOrderId} newest-first — so a positional answer is one
 * of them reporting the wrong time.
 */
export function mergeFills(fills: Fill[]): Fill | undefined {
  const first = fills[0];
  if (!first) {
    return undefined;
  }

  let size = new Big(0);
  let notional = new Big(0);
  let fee = new Big(0);
  let earliest = first;

  for (const fill of fills) {
    const fillSize = new Big(fill.size);
    size = size.plus(fillSize);
    notional = notional.plus(fillSize.times(fill.price));
    fee = fee.plus(fill.fee);

    if (Date.parse(fill.created_at) < Date.parse(earliest.created_at)) {
      earliest = fill;
    }
  }

  return {
    ...first,
    created_at: earliest.created_at,
    fee: fee.toString(),
    price: size.gt(0) ? notional.div(size).toString() : first.price,
    size: size.toString(),
  };
}

export interface IbkrFillWatcher {
  stop: () => void;
}

/**
 * Polls for executions and reports each completed order once.
 *
 * The Web API does offer a WebSocket, but it needs its own session handshake and re-subscribes on
 * every reconnect; polling the trades endpoint covers the same ground for a strategy that places
 * an order and waits for its fill. Only executions seen after the first poll are reported, so a
 * fresh watcher does not replay the day's history as if it had just happened.
 *
 * An order is reported when IBKR no longer lists it as working, with its executions merged. IBKR
 * fills a four-share order as one share and then three, and the consumer contract removes the
 * pending order on the first fill it is handed, so emitting each execution separately would hand
 * a strategy one share and drop the other three.
 */
export async function startIbkrFillWatcher(input: {
  api: IbkrAPI;
  emit: (fill: Fill) => void;
  getFeeAsset: (pair: TradingPair) => Promise<string>;
  getQuoteCurrency: (conid: string | number | null | undefined) => Promise<string>;
  isStillWorking: (orderId: string) => Promise<boolean>;
  pollIntervalMs: number;
}): Promise<IbkrFillWatcher> {
  const {api, emit, getFeeAsset, getQuoteCurrency, isStillWorking, pollIntervalMs} = input;
  const seenExecutions = new Set<string>();
  const reportedOrders = new Set<string>();
  let primed = false;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  /** Executions of an order that is still working, held until IBKR says it is done. */
  const pendingByOrder = new Map<string, Fill[]>();

  const collect = async (trade: IbkrTrade): Promise<void> => {
    if (!IbkrBrokerMapper.isInstrumentTrade(trade)) {
      // Currency conversions share this feed but are nobody's order — see `isInstrumentTrade`.
      return;
    }

    const symbol = trade.symbol;
    if (!symbol) {
      return;
    }

    const pair = new TradingPair(symbol, await getQuoteCurrency(trade.conid));
    const fill = IbkrBrokerMapper.toFill(trade, pair, await getFeeAsset(pair));
    if (!fill) {
      return;
    }

    if (!fill.order_id) {
      /*
       * IBKR omits `order_id` on anything not placed through the API, and the mapper reports that
       * absence as an empty string. Grouping by it would file every manually placed execution on
       * the account under one key and merge them into a single fill with a summed size and a
       * blended price across unrelated instruments. Nothing here placed those orders, so there is
       * no pending order waiting on them either.
       */
      return;
    }

    const existing = pendingByOrder.get(fill.order_id);
    if (existing) {
      existing.push(fill);
    } else {
      pendingByOrder.set(fill.order_id, [fill]);
    }
  };

  const poll = async () => {
    const trades = await api.getTrades();

    for (const trade of trades) {
      const executionKey = toExecutionKey(trade);
      if (seenExecutions.has(executionKey)) {
        continue;
      }

      if (!primed) {
        seenExecutions.add(executionKey);
        continue;
      }

      /*
       * Marked seen only once it has been turned into a fill. Reserving the key up front means a
       * failed currency or fee lookup — swallowed by the caller of a scheduled poll — drops that
       * execution from every later poll, losing the fill even after the gateway recovers.
       */
      await collect(trade);
      seenExecutions.add(executionKey);
    }

    for (const [orderId, fills] of pendingByOrder) {
      if (reportedOrders.has(orderId) || (await isStillWorking(orderId))) {
        continue;
      }

      const merged = mergeFills(fills);
      if (merged) {
        reportedOrders.add(orderId);
        pendingByOrder.delete(orderId);
        emit(merged);
      }
    }

    primed = true;
  };

  /*
   * The baseline is awaited before the watcher is handed back. Leaving it in flight lets an order
   * placed straight afterwards execute while the first response is still on its way: that
   * execution then arrives in the baseline, is filed as history and never reported.
   *
   * It is also the one poll allowed to fail outwards. Swallowing it would leave `primed` false and
   * hand back a watcher whose next successful poll files everything it sees as history — including
   * the executions of orders placed after this call, which are then suppressed for good. A caller
   * can retry a rejection; it cannot notice a watcher that has quietly gone deaf.
   */
  await poll();

  /*
   * Chained rather than `setInterval`: a tick must not start while the previous poll is still
   * awaiting `getTrades`. That call retries indefinitely by default, so overlapping ticks pile up
   * one more retry loop every interval for as long as the gateway is down.
   */
  const scheduleNext = () => {
    if (stopped) {
      return;
    }
    // A failed poll is transient: the next tick tries again rather than killing the watcher.
    timer = setTimeout(
      () =>
        void poll()
          .catch(() => undefined)
          .finally(scheduleNext),
      pollIntervalMs
    );
  };
  scheduleNext();

  return {
    stop: () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
    },
  };
}

/** A topic id for one fill subscription. */
export function createFillTopicId(): string {
  return randomUUID();
}
