import assert from 'node:assert';
import {randomUUID} from 'node:crypto';
import Big from 'big.js';
import {
  Broker,
  type Candle,
  type FeeRate,
  type Fill,
  type LimitOrderOptions,
  type MarketOrderOptions,
  type OrderOptions,
  OrderPosition,
  OrderSide,
  OrderType,
  type PendingLimitOrder,
  type PendingMarketOrder,
  type PendingOrder,
  type TradingRules,
} from './Broker.js';
import {getCandlesUntil, type MarketDataSource} from './MarketDataSource.js';
import type {TradingPair} from './TradingPair.js';
import {MockBalances, type ExchangeMockBalance} from './MockBalances.js';
import {
  applyNotionalTradingRules,
  applyTradingRules,
  limitFillPrice,
  marketFillPrice,
  roundDownToIncrement,
} from './brokerMockPricing.js';

export type {ExchangeMockBalance};

export interface BrokerMockSlippageConfig {
  /** Fraction of the fill price lost to slippage: "0.01" is 1%. Applied against market fills only. */
  rate?: Big;
  /** Keep slipped fills inside the candle's traded range (default `true`). */
  clamp?: boolean;
}

export abstract class BrokerMock extends Broker {
  readonly #balances: MockBalances;
  readonly #pendingOrders: PendingOrder[] = [];
  /**
   * Exact amount put on hold per order, so cancels and fills release precisely what was
   * held — reconstructing the hold from order fields drifts once prices improve on fill.
   */
  readonly #orderHolds = new Map<string, {amount: Big; currency: string}>();
  readonly #fills: Fill[] = [];
  #currentCandle: Candle | undefined;
  #startTime: string | undefined;
  readonly #marketData: Pick<MarketDataSource, 'getCandles'> | undefined;
  #nextOrderId = 1;
  readonly #orderTopics = new Set<string>();
  readonly #slippageRate: Big;
  readonly #clampSlippage: boolean;

  constructor(config: {
    balances: Map<string, ExchangeMockBalance>;
    /** Real candle history for {@link getRecentCandles}, e.g. a strategy's warm-up. Without it there is none. */
    marketData?: Pick<MarketDataSource, 'getCandles'>;
    slippage?: BrokerMockSlippageConfig;
  }) {
    super('BrokerMock');
    this.#balances = new MockBalances(config.balances);
    this.#marketData = config.marketData;
    this.#slippageRate = config.slippage?.rate ?? new Big(0);
    assert.ok(
      this.#slippageRate.gte(0) && this.#slippageRate.lt(1),
      `Slippage rate "${this.#slippageRate.toFixed()}" must be within [0, 1)`
    );
    this.#clampSlippage = config.slippage?.clamp ?? true;
  }

  /**
   * The `count` candles that closed before the mock's current time (see {@link getTime}), fetched
   * from the configured market data. At the start of a backtest that is the history before its
   * first candle, so a strategy can warm up without seeing the candles it is tested on.
   */
  async getRecentCandles(pair: TradingPair, count: number, intervalInMillis: number): Promise<Candle[]> {
    if (!this.#marketData) {
      return [];
    }
    const nowInMillis = Date.parse(await this.getTime());
    return getCandlesUntil(this.#marketData, pair, count, intervalInMillis, nowInMillis - intervalInMillis);
  }

  abstract override getFeeRates(pair: TradingPair): Promise<FeeRate>;
  abstract override getTradingRules(pair: TradingPair): Promise<TradingRules>;
  abstract override getName(): string;
  abstract override getSmallestInterval(): number;
  /**
   * Matches pending orders against the given candle's price range and returns new fills.
   * Orders placed on candle N are not matched until candle N+1 (realistic 1-candle delay).
   */
  processCandle(candle: Candle) {
    this.#currentCandle = candle;
    const newFills: Fill[] = [];
    const remaining: PendingOrder[] = [];

    for (const order of this.#pendingOrders) {
      const fill = this.#tryMatch(order, candle);
      if (fill) {
        this.#applyFill(fill, order);
        newFills.push(fill);
      } else {
        remaining.push(order);
      }
    }

    this.#pendingOrders.length = 0;
    this.#pendingOrders.push(...remaining);

    // Notify `watchOrders()` subscribers, mirroring a real broker's WebSocket fill stream.
    for (const fill of newFills) {
      for (const topicId of this.#orderTopics) {
        this.emit(topicId, fill);
      }
    }

    return newFills;
  }

  #tryMatch(order: PendingOrder, candle: Candle): Fill | null {
    const range = {high: new Big(candle.high), low: new Big(candle.low), open: new Big(candle.open)};
    const fillPrice =
      order.type === OrderType.MARKET
        ? marketFillPrice(order.side, range, this.#slippageRate, this.#clampSlippage)
        : limitFillPrice(order.side, new Big(order.price), range);
    if (!fillPrice) {
      return null;
    }

    const feeRate = this.#getFeeRateSync(order.type);
    let fee: Big;
    let size: string;

    if (order.type === OrderType.MARKET && order.sizeInCounter) {
      /*
       * Notional order: `size` is the total counter spend. The fee comes out of that
       * spend, and the base quantity is whatever the remainder buys at the fill price —
       * conversion happens here, at fill time, never at placement time with a stale price.
       */
      const grossCounter = new Big(order.size);
      const netCounter = grossCounter.div(new Big(1).plus(feeRate));
      fee = grossCounter.minus(netCounter);
      size = netCounter.div(fillPrice).toFixed();
    } else {
      fee = new Big(order.size).mul(fillPrice).mul(feeRate);
      size = order.size;
    }

    return {
      created_at: candle.openTimeInISO,
      fee: fee.toFixed(),
      feeAsset: order.pair.counter,
      order_id: order.id,
      pair: order.pair,
      position: OrderPosition.LONG,
      price: fillPrice.toFixed(),
      side: order.side,
      size,
    };
  }

  #applyFill(fill: Fill, order: PendingOrder) {
    const hold = this.#orderHolds.get(order.id);
    assert.ok(hold, `No hold recorded for order "${order.id}"`);
    this.#balances.settle(fill, hold.amount);
    this.#orderHolds.delete(order.id);
    this.#fills.push(fill);
  }

  protected override async placeOrder(pair: TradingPair, options: LimitOrderOptions): Promise<PendingLimitOrder>;
  protected override async placeOrder(pair: TradingPair, options: MarketOrderOptions): Promise<PendingMarketOrder>;
  protected override async placeOrder(pair: TradingPair, options: OrderOptions) {
    const rules = await this.getTradingRules(pair);
    const size = this.#validatedSize(options, rules);
    const limitPrice =
      options.type === OrderType.LIMIT
        ? roundDownToIncrement(new Big(options.price), new Big(rules.counter_increment))
        : undefined;
    const orderId = String(this.#nextOrderId++);

    // Validate balance and put amount on hold
    const hold =
      options.side === OrderSide.BUY
        ? {amount: this.#counterToHold(options, size, limitPrice), currency: pair.counter}
        : {amount: size, currency: pair.base};
    this.#balances.hold(hold.currency, hold.amount);
    this.#orderHolds.set(orderId, hold);

    const base = {id: orderId, pair, side: options.side, size: size.toFixed()};
    if (options.type === OrderType.LIMIT && limitPrice) {
      const pending: PendingLimitOrder = {...base, price: limitPrice.toFixed(), type: OrderType.LIMIT};
      this.#pendingOrders.push(pending);
      return pending;
    }

    const pending: PendingMarketOrder = {
      ...base,
      sizeInCounter: options.type === OrderType.MARKET && options.sizeInCounter,
      type: OrderType.MARKET,
    };
    this.#pendingOrders.push(pending);
    return pending;
  }

  #validatedSize(options: OrderOptions, rules: TradingRules) {
    if (options.type === OrderType.MARKET && options.sizeInCounter) {
      assert.ok(options.side === OrderSide.BUY, 'BrokerMock only supports counter-sized (notional) MARKET BUY orders');
      const price = this.#currentCandle ? new Big(this.#currentCandle.close) : undefined;
      const estimate = price?.gt(0) ? {feeRate: this.#getFeeRateSync(OrderType.MARKET), price} : undefined;
      return applyNotionalTradingRules(new Big(options.size), rules, estimate);
    }
    const validated = applyTradingRules(new Big(options.size), options, rules);
    assert.ok(validated, `Order size "${options.size}" violates the trading rules`);
    return validated;
  }

  /** Counter amount a BUY puts on hold: the estimated cost plus fee, or the notional spend as-is. */
  #counterToHold(options: OrderOptions, size: Big, limitPrice: Big | undefined) {
    if (options.type === OrderType.MARKET && options.sizeInCounter) {
      // Notional market order: the size IS the full counter spend, fee included.
      return size;
    }
    // Market orders hold best-effort, based on the current candle price if available.
    const price = limitPrice ?? (this.#currentCandle ? new Big(this.#currentCandle.close) : new Big(0));
    const cost = size.mul(price);
    return cost.plus(cost.mul(this.#getFeeRateSync(options.type)));
  }

  /** Cached fee rates to avoid async in hot path */
  #cachedFeeRates: FeeRate | undefined;

  setCachedFeeRates(rates: FeeRate) {
    this.#cachedFeeRates = rates;
  }

  #getFeeRateSync(orderType: OrderType) {
    if (!this.#cachedFeeRates) {
      throw new Error('Fee rates not cached. Call setCachedFeeRates() before processing candles.');
    }
    return this.#cachedFeeRates[orderType];
  }

  async listBalances() {
    return this.#balances.list();
  }

  async getFills(pair: TradingPair) {
    return this.#fills
      .filter(f => f.pair.base === pair.base && f.pair.counter === pair.counter)
      .slice()
      .reverse();
  }

  async getFillByOrderId(_pair: TradingPair, orderId: string) {
    return this.#fills.find(f => f.order_id === orderId);
  }

  async cancelOrderById(_pair: TradingPair, orderId: string) {
    const index = this.#pendingOrders.findIndex(o => o.id === orderId);
    if (index === -1) {
      throw new Error(`Order ${orderId} not found`);
    }

    this.#pendingOrders.splice(index, 1);

    // Give back exactly what was held for this order (works for limit AND market buys)
    const hold = this.#orderHolds.get(orderId);
    assert.ok(hold, `No hold recorded for order "${orderId}"`);

    this.#balances.refund(hold.currency, hold.amount);
    this.#orderHolds.delete(orderId);
  }

  async cancelOpenOrders(pair: TradingPair) {
    const toCancel = this.#pendingOrders.filter(o => o.pair.base === pair.base && o.pair.counter === pair.counter);
    const canceledIds: string[] = [];
    for (const order of toCancel) {
      await this.cancelOrderById(pair, order.id);
      canceledIds.push(order.id);
    }
    return canceledIds;
  }

  async getLatestCandle(_pair: TradingPair, _intervalInMillis: number) {
    if (!this.#currentCandle) {
      throw new Error('No candle has been processed yet');
    }
    return this.#currentCandle;
  }

  /**
   * Sets the clock for the time before the first candle is processed, e.g. to the start of a
   * backtest window, so a strategy warming up at that point is not handed the real current time.
   */
  setStartTime(timeInISO: string) {
    this.#startTime = timeInISO;
  }

  async getTime() {
    return this.#currentCandle?.openTimeInISO ?? this.#startTime ?? new Date().toISOString();
  }

  async getOpenOrders(pair: TradingPair) {
    return this.#pendingOrders.filter(o => o.pair.base === pair.base && o.pair.counter === pair.counter);
  }

  /**
   * Subscribe to simulated order fill updates. Fills produced by {@link processCandle}
   * are emitted as {@link Fill} objects via EventEmitter using the returned topicId as
   * the event name, matching a real broker's WebSocket fill stream.
   *
   * @returns The generated topicId (UUID) for this subscription
   */
  async watchOrders() {
    const topicId = randomUUID();
    this.#orderTopics.add(topicId);
    return topicId;
  }

  unwatchOrders(topicId: string) {
    this.removeAllListeners(topicId);
    this.#orderTopics.delete(topicId);
  }

  disconnect() {
    for (const topicId of this.#orderTopics) {
      this.removeAllListeners(topicId);
    }
    this.#orderTopics.clear();
  }

  getPendingOrders() {
    return [...this.#pendingOrders];
  }
}
