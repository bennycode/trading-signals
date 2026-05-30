import Big from 'big.js';
import {EventEmitter} from 'node:events';
import {CandleBatcher} from '../candle/CandleBatcher.js';
import type {BatchedCandle} from '../candle/BatchedCandle.js';
import {ONE_MINUTE_IN_MS} from '../candle/BatchedCandle.js';
import type {Candle, Fill, PendingOrder} from '../broker/Broker.js';
import {OrderSide, OrderType} from '../broker/Broker.js';
import {OrderSizeBelowMinimumError} from './OrderSizeBelowMinimumError.js';
import {AllAvailableAmount} from './TradingSessionTypes.js';
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

  get running(): boolean {
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

    const balances = await this.#broker.getAvailableBalances(this.#pair);
    const fills = await this.#broker.getFills(this.#pair);
    const lastOrderSide = fills.length > 0 ? fills[0].side : undefined;

    this.#state = {
      baseBalance: balances.base,
      counterBalance: balances.counter,
      feeRates,
      lastOrderSide,
      tradingRules,
    };

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
    this.#state = null;
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

      const advice = await this.#strategy.onCandle(batchedCandle, this.#state!);
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
      this.emit('fill', fill);

      const balances = await this.#broker.getAvailableBalances(this.#pair);
      this.#state = {
        ...this.#state,
        baseBalance: balances.base,
        counterBalance: balances.counter,
        lastOrderSide: fill.side,
      };

      if (this.#strategy.onFill) {
        await this.#strategy.onFill(fill, this.#state);
      }

      this.emit('orderFilled', pending);
      if (this.#strategy.onOrderFilled) {
        await this.#strategy.onOrderFilled(pending, this.#state);
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  };

  async #executeAdvice(advice: OrderAdvice): Promise<void> {
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
    }

    const balances = await this.#broker.getAvailableBalances(this.#pair);
    this.#state = {
      ...this.#state!,
      baseBalance: balances.base,
      counterBalance: balances.counter,
    };

    const size = this.#resolveOrderSize(advice);
    if (!size) {
      return;
    }

    const {base_min_size, counter_min_size} = this.#state.tradingRules;
    const minimumSize = advice.amountIn === 'counter' ? counter_min_size : base_min_size;

    if (size.lt(minimumSize)) {
      this.emit(
        'error',
        new OrderSizeBelowMinimumError({
          amountIn: advice.amountIn,
          minimumSize,
          side: advice.side,
          size: size.toFixed(),
        })
      );
      return;
    }

    let order: PendingOrder;

    if (advice.type === OrderType.LIMIT) {
      const price = this.#applyPrecision(new Big(advice.price), this.#state.tradingRules.counter_increment);
      order = await this.#broker.placeLimitOrder(this.#pair, {
        price: price.toFixed(),
        side: advice.side,
        size: size.toFixed(),
      });
    } else {
      order = await this.#broker.placeMarketOrder(this.#pair, {
        side: advice.side,
        size: size.toFixed(),
        sizeInCounter: advice.amountIn === 'counter',
      });
    }

    this.#pendingOrders.set(order.id, order);
    this.emit('order', order);
  }

  #resolveOrderSize(advice: OrderAdvice): Big | null {
    const {tradingRules} = this.#state!;

    if (advice.amount !== AllAvailableAmount) {
      const amount = new Big(advice.amount);
      if (advice.amountIn === 'counter') {
        return this.#applyPrecision(amount, tradingRules.counter_increment);
      }
      return this.#applyPrecision(amount, tradingRules.base_increment);
    }

    if (advice.side === OrderSide.SELL) {
      return this.#applyPrecision(this.#state!.baseBalance, tradingRules.base_increment);
    }

    // BUY
    if (advice.amountIn === 'counter') {
      return this.#applyPrecision(this.#state!.counterBalance, tradingRules.counter_increment);
    }

    // BUY + base amount + LIMIT → derive from counter balance / price
    if (advice.type === OrderType.LIMIT) {
      const baseAmount = this.#state!.counterBalance.div(new Big(advice.price));
      return this.#applyPrecision(baseAmount, tradingRules.base_increment);
    }

    // Unreachable: MarketBuyBaseAdvice requires a non-null amount, handled above
    return null;
  }

  #applyPrecision(value: Big, increment: string): Big {
    const inc = new Big(increment);
    return value.div(inc).round(0, Big.roundDown).mul(inc);
  }
}
