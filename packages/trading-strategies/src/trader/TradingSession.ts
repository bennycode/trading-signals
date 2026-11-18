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

  /**
   * How long an order the book has stopped listing still counts as working. A filled order leaves
   * the book when it fills, which is before its fill is reported: Trading212 polls fills once a
   * minute, so anything shorter than that would read a fill on its way as an order that is gone.
   */
  static readonly #FILL_REPORT_GRACE_IN_MS = 2 * ONE_MINUTE_IN_MS;

  #state: TradingSessionState | null = null;
  /**
   * The orders of ours the broker's book listed when it was last read, so advice asking for one
   * of them can keep it. Read from the book rather than remembered from placing, because a
   * session that restarts onto its own resting orders never placed them.
   */
  #ordersOnTheBook: readonly PendingOrder[] = [];
  #adviceExecutor: AdviceExecutor | null = null;
  /**
   * Orders of ours whose outcome is still unaccounted for, which a fill arriving late has to find
   * to be worth anything: it carries the price that was paid or received. An order is dropped from
   * here only once its outcome is known — its fill was handled, or the broker confirmed the cancel.
   */
  readonly #pendingOrders = new Map<string, PendingOrder>();
  /** When a pending order of ours was first found missing from the book, by candle time. */
  readonly #missingSince = new Map<string, number>();
  /** The candle the session is on, which is the clock the fill-report grace is measured by. */
  #candleTime: number | null = null;
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
    this.#missingSince.clear();
    this.#candleTime = null;
    this.#ordersOnTheBook = [];
    this.#state = null;
    this.#adviceExecutor = null;
    this.emit('stopped');
  }

  /**
   * Candles and fills are handled one at a time, in the order they arrive. An event emitter does
   * not wait for an async listener, so two candles arriving while the broker is answering would
   * otherwise be in flight at once: whichever reply came back first would feed its candle to the
   * indicators, and either could place an order against the balance the other had read.
   */
  #work: Promise<void> = Promise.resolve();

  #inTurn(task: () => Promise<void>): Promise<void> {
    // Both arms run the next task, so one that rejects cannot leave the queue refusing its turn.
    this.#work = this.#work.then(task, task);
    return this.#work;
  }

  readonly #onCandle = (candle: Candle | BatchedCandle): Promise<void> =>
    this.#inTurn(() => this.#handleCandle(candle));

  readonly #onFill = (fill: Fill): Promise<void> => this.#inTurn(() => this.#handleFill(fill));

  async #handleCandle(candle: Candle | BatchedCandle): Promise<void> {
    try {
      const batchedCandle = CandleBatcher.isBatchedCandle(candle) ? candle : CandleBatcher.toBatchedCandle(candle);
      if (!CandleBatcher.isOneMinuteCandle(batchedCandle)) {
        throw new Error(
          `Strategies require 1-minute candles but received ${batchedCandle.sizeInMillis}ms. ` +
            `Use CandleBatcher to aggregate candles inside your strategy if you need a larger timeframe.`
        );
      }
      this.emit('candle', batchedCandle);
      this.#candleTime = batchedCandle.openTimeInMillis;

      /*
       * Read before every candle rather than only after our own orders and fills. A strategy
       * derives its position from this balance, and a position can appear or disappear without
       * us: bought by hand, closed by a rebalance, sold by another strategy. Reading it once at
       * startup would leave an exit-only strategy waiting forever for a position it already
       * guards, and would keep reporting one that is long gone. The backtester rebuilds this
       * state per candle for the same reason.
       */
      const snapshot = await this.#snapshot();

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
  }

  async #handleFill(fill: Fill): Promise<void> {
    try {
      const pending = this.#pendingOrders.get(fill.order_id);
      if (!this.#state || !pending) {
        return;
      }

      this.#ordersOnTheBook = this.#ordersOnTheBook.filter(order => order.id !== fill.order_id);
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

      this.#forget(fill.order_id);
      this.emit('orderFilled', pending);
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  async #executeAdvice(advice: OrderAdvice): Promise<void> {
    /*
     * A rule that keeps matching — a resting limit sell priced off a fill, say — produces the same
     * advice on every candle. Replacing the order with an identical one would send it to the back
     * of the exchange's queue each time and report a trade the user has already been told about,
     * so an order that is already working for this advice is left alone.
     */
    const state = this.#state;
    const resting =
      state &&
      this.#ordersOnTheBook.find(order =>
        sameOrder(advice, order, {ownedBase: ownedBase(state), rules: state.tradingRules})
      );
    if (resting) {
      return;
    }

    if (this.#ordersStillWorking().length > 0) {
      /*
       * Only forget orders that were actually canceled. Any pending order missing
       * from the canceled list filled before our cancel reached the exchange —
       * keep it so the late FILL websocket event still matches and onFinish fires.
       */
      const canceledIds = await this.#broker.cancelOpenOrders(this.#pair);
      for (const orderId of canceledIds) {
        this.#forget(orderId);
      }
      this.#ordersOnTheBook = [];
    }

    const outcome = await this.#adviceExecutor!.execute(advice);

    if (outcome.status === 'PLACED') {
      this.#pendingOrders.set(outcome.order.id, outcome.order);
      this.#ordersOnTheBook = [outcome.order];
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
    this.#noteOrdersMissingFromBook(openOrders);
    this.#ordersOnTheBook = openOrders.filter(order => this.#pendingOrders.has(order.id));
    const ours = this.#ordersStillWorking();

    return {
      ...balances,
      /*
       * Answered from this session's own orders, not from the broker's book: someone else's
       * resting order is no reason to leave a holding unguarded. An order that has left the book
       * still counts for a reading or two, because a filled order leaves the book at the same
       * moment its notification is sent, and reading that gap as "nothing of ours is working"
       * would let a position be adopted that our own fill is about to explain.
       */
      hasOutstandingBuy: ours.some(order => order.side === OrderSide.BUY),
      hasOutstandingSell: ours.some(order => order.side === OrderSide.SELL),
    };
  }

  #noteOrdersMissingFromBook(openOrders: readonly PendingOrder[]): void {
    const onTheBook = new Set(openOrders.map(order => order.id));

    for (const id of this.#pendingOrders.keys()) {
      if (onTheBook.has(id)) {
        this.#missingSince.delete(id);
      } else if (this.#candleTime !== null && !this.#missingSince.has(id)) {
        this.#missingSince.set(id, this.#candleTime);
      }
    }
  }

  /**
   * The orders of ours that can still do something. An order the broker has stopped listing goes
   * on counting until its fill has had time to be reported, and is treated as no longer working
   * after that: Trading212's day orders expire overnight and anyone can cancel one in the broker's
   * own interface, and an order counted as working forever would block adoption forever with it.
   *
   * It is still remembered for its fill, which is a separate question from whether it is working:
   * a delayed notification has to find its order to report the price it traded at.
   */
  #ordersStillWorking(): PendingOrder[] {
    const now = this.#candleTime;

    return [...this.#pendingOrders]
      .filter(([id]) => {
        const since = this.#missingSince.get(id);
        return since === undefined || now === null || now - since < TradingSession.#FILL_REPORT_GRACE_IN_MS;
      })
      .map(([, order]) => order);
  }

  /** Drops an order whose outcome is now known, so nothing is waiting for a fill that cannot come. */
  #forget(orderId: string): void {
    this.#pendingOrders.delete(orderId);
    this.#missingSince.delete(orderId);
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
