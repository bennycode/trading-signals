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
 * Polls for executions and reports each new one.
 *
 * The Web API does offer a WebSocket, but it needs its own session handshake and re-subscribes on
 * every reconnect; polling the trades endpoint covers the same ground for a strategy that places
 * an order and waits for its fill. Only executions seen after the first poll are reported, so a
 * fresh watcher does not replay the day's history as if it had just happened.
 */
export function startIbkrFillWatcher(input: {
  api: IbkrAPI;
  emit: (fill: Fill) => void;
  getFeeAsset: (pair: TradingPair) => Promise<string>;
  getQuoteCurrency: (conid: string | number | null | undefined) => Promise<string>;
  pollIntervalMs: number;
}): NodeJS.Timeout {
  const {api, emit, getFeeAsset, getQuoteCurrency, pollIntervalMs} = input;
  const seenExecutions = new Set<string>();
  let primed = false;

  const poll = async () => {
    try {
      const trades = await api.getTrades();

      for (const trade of trades) {
        const executionKey = toExecutionKey(trade);
        if (seenExecutions.has(executionKey)) {
          continue;
        }
        seenExecutions.add(executionKey);

        if (!primed) {
          continue;
        }

        // Currency conversions share this feed but are nobody's order — see `isInstrumentTrade`.
        if (!IbkrBrokerMapper.isInstrumentTrade(trade)) {
          continue;
        }

        const symbol = trade.symbol;
        if (!symbol) {
          continue;
        }

        const pair = new TradingPair(symbol, await getQuoteCurrency(trade.conid));
        const fill = IbkrBrokerMapper.toFill(trade, pair, await getFeeAsset(pair));
        if (fill) {
          emit(fill);
        }
      }

      primed = true;
    } catch {
      // A failed poll is transient; the next tick tries again rather than killing the watcher.
    }
  };

  void poll();
  return setInterval(() => void poll(), pollIntervalMs);
}

/** A topic id for one fill subscription. */
export function createFillTopicId(): string {
  return randomUUID();
}
