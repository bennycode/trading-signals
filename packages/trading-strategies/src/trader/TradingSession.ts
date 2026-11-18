import {EventEmitter} from 'node:events';
import {CandleBatcher, ONE_MINUTE_IN_MS} from '@typedtrader/exchange';
import type {BatchedCandle, Candle, Fill, PendingOrder} from '@typedtrader/exchange';
import {AdviceExecutor} from './AdviceExecutor.js';
import {sameOrder} from './sameOrder.js';
import {sessionBalances} from './sessionBalances.js';
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
  /** The advice the order currently on the book was placed for, so an identical one can be kept. */
  #workingAdvice: OrderAdvice | null = null;
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

    const balances = await this.#balances();
    const fills = await this.#broker.getFills(this.#pair);
    const lastOrderSide = fills[0]?.side;

    this.#state = {
      baseBalance: balances.base,
      baseBalanceOnHold: balances.baseOnHold,
      counterBalance: balances.counter,
      feeRates,
      hasOutstandingOrder: this.#pendingOrders.size > 0,
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
    this.#workingAdvice = null;
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
      const balances = await this.#balances();
      this.#state = {
        ...this.#state!,
        baseBalance: balances.base,
        baseBalanceOnHold: balances.baseOnHold,
        counterBalance: balances.counter,
        hasOutstandingOrder: this.#pendingOrders.size > 0,
      };

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

      this.#pendingOrders.delete(fill.order_id);
      this.#workingAdvice = null;
      this.emit('fill', fill);

      const balances = await this.#balances();
      this.#state = {
        ...this.#state,
        baseBalance: balances.base,
        baseBalanceOnHold: balances.baseOnHold,
        counterBalance: balances.counter,
        hasOutstandingOrder: this.#pendingOrders.size > 0,
        lastOrderSide: fill.side,
      };

      if (this.#strategy.onFill) {
        await this.#strategy.onFill(fill, this.#state);
      }

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
    if (this.#workingAdvice && sameOrder(this.#workingAdvice, advice) && this.#pendingOrders.size > 0) {
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
      this.#workingAdvice = null;
    }

    const outcome = await this.#adviceExecutor!.execute(advice);

    if (outcome.status === 'PLACED') {
      this.#pendingOrders.set(outcome.order.id, outcome.order);
      this.#workingAdvice = advice;
      if (advice.reason) {
        this.#strategy.onMessage?.(advice.reason);
      }
    }

    /*
     * Read after the order was placed rather than from the outcome, which the executor captured
     * before placing it: a resting sell has moved base out of the available balance by now, and
     * mixing the two snapshots would count what it holds twice.
     */
    const balances = await this.#balances();
    this.#state = {
      ...this.#state!,
      baseBalance: balances.base,
      baseBalanceOnHold: balances.baseOnHold,
      counterBalance: balances.counter,
      hasOutstandingOrder: this.#pendingOrders.size > 0,
    };

    if (outcome.status === 'SKIPPED') {
      this.emit('error', outcome.error);
      return;
    }

    this.emit('order', outcome.order);
  }

  async #balances() {
    return sessionBalances(await this.#broker.listBalances(), this.#pair);
  }
}
