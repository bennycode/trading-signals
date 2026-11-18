import {EventEmitter} from 'node:events';
import {CandleBatcher, ONE_MINUTE_IN_MS, OrderSide} from '@typedtrader/exchange';
import type {BatchedCandle, Candle, Fill, PendingOrder} from '@typedtrader/exchange';
import {AdviceExecutor} from './AdviceExecutor.js';
import {sameOrder} from './sameOrder.js';
import {ownedBase} from './sessionBalances.js';
import {sessionBalances} from './sessionBalances.js';
import type {SessionBalances} from './sessionBalances.js';

/** What one read of the broker says: what is owned, and which of our orders are still working. */
type BrokerSnapshot = SessionBalances & {
  hasOutstandingBuy: boolean;
  hasOutstandingSell: boolean;
  openOrders: PendingOrder[];
};
import type {
  OrderAdvice,
  TradingSessionEventMap,
  TradingSessionOptions,
  TradingSessionState,
} from './TradingSessionTypes.js';

export class TradingSession extends EventEmitter<TradingSessionEventMap> {
  readonly #broker;
  readonly #pair;
  readonly #strategy;

  #state: TradingSessionState | null = null;
  /** The order currently on the book, so advice asking for that same order can keep it. */
  #workingOrder: PendingOrder | null = null;
  /** Orders of ours the broker stopped listing once, which a second reading confirms are gone. */
  readonly #missingFromBook = new Set<string>();
  #adviceExecutor: AdviceExecutor | null = null;
  readonly #pendingOrders = new Map<string, PendingOrder>();
  #candleTopicId: string | null = null;
  #orderTopicId: string | null = null;
  #running = false;

  constructor(options: TradingSessionOptions) {
    super();
    this.#broker = options.broker;
    this.#pair = options.pair;
    this.#strategy = options.strategy;
    this.#strategy.onMessage = text => this.emit('message', text);
  }

  get running() {
    return this.#running;
  }

  async start(): Promise<void> {
    if (this.#running) {
      throw new Error('TradingSession is already running');
    }

    const [tradingRules, feeRates] = await Promise.all([
      this.#broker.getTradingRules(this.#pair),
      this.#broker.getFeeRates(this.#pair),
    ]);

    // Subscribe to order WebSocket early so we don't miss fills for open orders
    this.#orderTopicId = await this.#broker.watchOrders();
    this.#broker.on(this.#orderTopicId, this.#onFill);

    // Pick up all previously placed open orders
    const openOrders = await this.#broker.getOpenOrders(this.#pair);
    for (const order of openOrders) {
      this.#pendingOrders.set(order.id, order);
    }

    const snapshot = await this.#snapshot();
    const fills = await this.#broker.getFills(this.#pair);
    const lastOrderSide = fills[0]?.side;

    this.#state = {
      ...this.#stateFrom(snapshot),
      feeRates,
      lastOrderSide,
      tradingRules,
    };

    this.#adviceExecutor = new AdviceExecutor({broker: this.#broker, feeRates, pair: this.#pair, tradingRules});

    await this.#strategy.init?.(this.#broker, this.#pair);

    // Subscribe to candles only after state is ready
    const openTimeInISO = new Date().toISOString();
    this.#candleTopicId = await this.#broker.watchCandles(this.#pair, ONE_MINUTE_IN_MS, openTimeInISO);
    this.#broker.on(this.#candleTopicId, this.#onCandle);

    this.#running = true;
    this.emit('started');
  }

  async stop(options?: {cancelOpenOrders: boolean}): Promise<void> {
    if (options?.cancelOpenOrders) {
      await this.#broker.cancelOpenOrders(this.#pair);
    }

    if (this.#candleTopicId) {
      this.#broker.unwatchCandles(this.#candleTopicId);
      this.#candleTopicId = null;
    }

    if (this.#orderTopicId) {
      this.#broker.unwatchOrders(this.#orderTopicId);
      this.#orderTopicId = null;
    }

    // Drop the message relay so a stopped session can't keep emitting on the strategy's behalf.
    this.#strategy.onMessage = undefined;

    this.#running = false;
    this.#pendingOrders.clear();
    this.#missingFromBook.clear();
    this.#workingOrder = null;
    this.#state = null;
    this.#adviceExecutor = null;
    this.emit('stopped');
  }

  readonly #onCandle = async (candle: Candle | BatchedCandle): Promise<void> => {
    try {
      const batchedCandle = CandleBatcher.isBatchedCandle(candle) ? candle : CandleBatcher.toBatchedCandle(candle);
      if (!CandleBatcher.isOneMinuteCandle(batchedCandle)) {
        throw new Error(
          `Strategies require 1-minute candles but received ${batchedCandle.sizeInMillis}ms. ` +
            `Use CandleBatcher to aggregate candles inside your strategy if you need a larger timeframe.`
        );
      }
      this.emit('candle', batchedCandle);

      /*
       * Read before every candle rather than only after our own orders and fills. A strategy
       * derives its position from this balance, and a position can appear or disappear without
       * us: bought by hand, closed by a rebalance, sold by another strategy. Reading it once at
       * startup would leave an exit-only strategy waiting forever for a position it already
       * guards, and would keep reporting one that is long gone. The backtester rebuilds this
       * state per candle for the same reason.
       */
      const snapshot = await this.#snapshot();
      /*
       * An order this session placed can leave the book without a fill of ours: Trading212's day
       * orders expire overnight, and anyone can cancel one in the broker's own interface. The
       * advice it was placed for is then not working any more, however well it is remembered.
       */
      const stillOpen = snapshot.openOrders.find(order => order.id === this.#workingOrder?.id);
      this.#workingOrder = stillOpen ?? null;

      // The session may have been stopped while the broker was answering.
      if (!this.#state) {
        return;
      }

      this.#state = {...this.#state, ...this.#stateFrom(snapshot)};

      const advice = await this.#strategy.onCandle(batchedCandle, this.#state);
      if (advice) {
        this.emit('advice', advice);
        await this.#executeAdvice(advice);
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  };

  readonly #onFill = async (fill: Fill): Promise<void> => {
    try {
      const pending = this.#pendingOrders.get(fill.order_id);
      if (!this.#state || !pending) {
        return;
      }

      this.#workingOrder = null;
      this.emit('fill', fill);

      const snapshot = await this.#snapshot();
      if (!this.#state) {
        return;
      }

      this.#state = {
        ...this.#state,
        ...this.#stateFrom(snapshot),
        lastOrderSide: fill.side,
      };

      if (this.#strategy.onFill) {
        await this.#strategy.onFill(fill, this.#state);
      }

      this.#pendingOrders.delete(fill.order_id);
      this.emit('orderFilled', pending);
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  };

  async #executeAdvice(advice: OrderAdvice): Promise<void> {
    /*
     * A rule that keeps matching — a resting limit sell priced off a fill, say — produces the same
     * advice on every candle. Replacing the order with an identical one would send it to the back
     * of the exchange's queue each time and report a trade the user has already been told about,
     * so an order that is already working for this advice is left alone.
     */
    const working = this.#workingOrder;
    if (
      working &&
      this.#state &&
      sameOrder(advice, working, {ownedBase: ownedBase(this.#state), rules: this.#state.tradingRules})
    ) {
      return;
    }

    if (this.#pendingOrders.size > 0) {
      /*
       * Only forget orders that were actually canceled. Any pending order missing
       * from the canceled list filled before our cancel reached the exchange —
       * keep it so the late FILL websocket event still matches and onFinish fires.
       */
      const canceledIds = await this.#broker.cancelOpenOrders(this.#pair);
      for (const orderId of canceledIds) {
        this.#pendingOrders.delete(orderId);
      }
      this.#workingOrder = null;
    }

    const outcome = await this.#adviceExecutor!.execute(advice);

    if (outcome.status === 'PLACED') {
      this.#pendingOrders.set(outcome.order.id, outcome.order);
      this.#workingOrder = outcome.order;
      if (advice.reason) {
        this.#strategy.onMessage?.(advice.reason);
      }
    }

    /*
     * The balance is left as the candle read it. Reading it again here would mix a snapshot taken
     * before the order was placed with one taken after, and the next candle reads it afresh
     * anyway — which is the only moment a strategy sees it.
     */
    if (outcome.status === 'SKIPPED') {
      this.emit('error', outcome.error);
      return;
    }

    this.emit('order', outcome.order);
  }

  /**
   * What the broker says right now: the balances, and the orders of ours still on its book. Both
   * are read together so that a decision is never made from two different moments, and both come
   * from the broker rather than from what this session remembers placing — an order can leave the
   * book without a fill of ours (expired, cancelled by hand, rejected later) and only the broker
   * knows that it has.
   */
  async #snapshot() {
    const [rawBalances, openOrders] = await Promise.all([
      this.#broker.listBalances(),
      this.#broker.getOpenOrders(this.#pair),
    ]);
    const balances = sessionBalances(rawBalances, this.#pair);
    this.#forgetOrdersThatLeftTheBook(openOrders);
    const ours = [...this.#pendingOrders.values()];

    return {
      ...balances,
      /*
       * Answered from this session's own unresolved orders, not from the broker's book. Someone
       * else's resting order is no reason to leave a holding unguarded, and an order of ours that
       * has left the book may still have a fill on its way: until that fill is in, the position
       * it explains is this session's to account for.
       */
      hasOutstandingBuy: ours.some(order => order.side === OrderSide.BUY),
      hasOutstandingSell: ours.some(order => order.side === OrderSide.SELL),
      openOrders,
    };
  }

  /**
   * Drops an order of ours that the broker has stopped listing and never reported a fill for.
   * Trading212's day orders expire overnight, and anyone can cancel one in the broker's own
   * interface; an order remembered forever would block adoption forever with it.
   *
   * Two readings are needed before forgetting one, because the first can race its fill: an order
   * that filled leaves the book at the same moment its notification is sent.
   */
  #forgetOrdersThatLeftTheBook(openOrders: readonly PendingOrder[]): void {
    const onTheBook = new Set(openOrders.map(order => order.id));

    for (const id of this.#pendingOrders.keys()) {
      if (onTheBook.has(id)) {
        this.#missingFromBook.delete(id);
        continue;
      }
      if (this.#missingFromBook.has(id)) {
        this.#pendingOrders.delete(id);
        this.#missingFromBook.delete(id);
        continue;
      }
      this.#missingFromBook.add(id);
    }
  }

  /** The state fields a snapshot of the broker decides, which every state build shares. */
  #stateFrom(snapshot: BrokerSnapshot) {
    return {
      baseBalance: snapshot.base,
      baseBalanceOnHold: snapshot.baseOnHold,
      counterBalance: snapshot.counter,
      hasOutstandingBuy: snapshot.hasOutstandingBuy,
      hasOutstandingSell: snapshot.hasOutstandingSell,
      shortBase: snapshot.shortBase,
    };
  }
}
