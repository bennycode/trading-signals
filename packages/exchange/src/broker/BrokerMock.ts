import assert from 'node:assert';
import {randomUUID} from 'node:crypto';
import Big from 'big.js';
import {
  Broker,
  type Balance,
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
import type {TradingPair} from './TradingPair.js';

export interface ExchangeMockBalance {
  available: Big;
  hold: Big;
}

export abstract class BrokerMock extends Broker {
  readonly #balances: Map<string, ExchangeMockBalance>;
  readonly #pendingOrders: PendingOrder[] = [];
  /**
   * Exact amount put on hold per order, so cancels and fills release precisely what was
   * held — reconstructing the hold from order fields drifts once prices improve on fill.
   */
  readonly #orderHolds = new Map<string, {amount: Big; currency: string}>();
  readonly #fills: Fill[] = [];
  #currentCandle: Candle | undefined;
  #historicalCandles: Candle[] = [];
  #nextOrderId = 1;
  readonly #orderTopics = new Set<string>();

  constructor(config: {balances: Map<string, ExchangeMockBalance>}) {
    super('BrokerMock');
    this.#balances = config.balances;
  }

  /** Seed the candles returned by {@link getRecentCandles} (used to exercise strategy warm-up). */
  setHistoricalCandles(candles: Candle[]) {
    this.#historicalCandles = candles;
  }

  /** Returns the most recent `count` seeded candles, oldest first — mirrors the live backward fetch. */
  async getRecentCandles(_pair: TradingPair, count: number, _intervalInMillis: number): Promise<Candle[]> {
    return count <= 0 ? [] : this.#historicalCandles.slice(-count);
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

  #tryMatch(order: PendingOrder, candle: Candle) {
    const pair = order.pair;
    const candleOpen = new Big(candle.open);
    const candleLow = new Big(candle.low);
    const candleHigh = new Big(candle.high);
    const size = new Big(order.size);

    let fillPrice: Big;

    if (order.type === OrderType.MARKET) {
      // Market orders fill at candle open price
      fillPrice = candleOpen;

      if (order.sizeInCounter) {
        /*
         * Notional order: `size` is the total counter spend. The fee comes out of that
         * spend, and the base quantity is whatever the remainder buys at the fill price —
         * conversion happens here, at fill time, never at placement time with a stale price.
         */
        const feeRate = this.#getFeeRateSync(OrderType.MARKET);
        const grossCounter = new Big(order.size);
        const netCounter = grossCounter.div(new Big(1).plus(feeRate));
        const fee = grossCounter.minus(netCounter);

        const fill: Fill = {
          created_at: candle.openTimeInISO,
          fee: fee.toFixed(),
          feeAsset: pair.counter,
          order_id: order.id,
          pair,
          position: OrderPosition.LONG,
          price: fillPrice.toFixed(),
          side: order.side,
          size: netCounter.div(fillPrice).toFixed(),
        };
        return fill;
      }
    } else {
      // Limit order
      const limitPrice = new Big(order.price);

      if (order.side === OrderSide.BUY) {
        // Limit buy fills if candle.low <= order.price
        if (candleLow.gt(limitPrice)) {
          return null;
        }
        // Price improvement: min(order.price, candle.open)
        fillPrice = limitPrice.lt(candleOpen) ? limitPrice : candleOpen;
      } else {
        // Limit sell fills if candle.high >= order.price
        if (candleHigh.lt(limitPrice)) {
          return null;
        }
        // Price improvement: max(order.price, candle.open)
        fillPrice = limitPrice.gt(candleOpen) ? limitPrice : candleOpen;
      }
    }

    const feeRate = this.#getFeeRateSync(order.type);
    const revenue = size.mul(fillPrice);
    const fee = revenue.mul(feeRate);

    const fill: Fill = {
      created_at: candle.openTimeInISO,
      fee: fee.toFixed(),
      feeAsset: pair.counter,
      order_id: order.id,
      pair,
      position: OrderPosition.LONG,
      price: fillPrice.toFixed(),
      side: order.side,
      size: order.size,
    };
    return fill;
  }

  #applyFill(fill: Fill, order: PendingOrder) {
    const size = new Big(fill.size);
    const price = new Big(fill.price);
    const fee = new Big(fill.fee);
    const hold = this.#orderHolds.get(order.id);
    assert.ok(hold, `No hold recorded for order "${order.id}"`);

    if (order.side === OrderSide.BUY) {
      const counterCost = size.mul(price).plus(fee);
      this.#releaseHold(order.pair.counter, hold.amount);
      /*
       * The hold was an estimate (limit price, or a pre-fill price for market orders).
       * Settle the difference: refund unspent counter on price improvement, or charge
       * the shortfall when the fill came in above the estimate.
       */
      const refund = hold.amount.minus(counterCost);
      if (!refund.eq(0)) {
        this.#addAvailable(order.pair.counter, refund);
      }
      this.#addAvailable(order.pair.base, size);
    } else {
      // Release base hold, add counter revenue
      this.#releaseHold(order.pair.base, hold.amount);
      const netRevenue = size.mul(price).minus(fee);
      this.#addAvailable(order.pair.counter, netRevenue);
    }

    this.#orderHolds.delete(order.id);
    this.#fills.push(fill);
  }

  protected override async placeOrder(pair: TradingPair, options: LimitOrderOptions): Promise<PendingLimitOrder>;
  protected override async placeOrder(pair: TradingPair, options: MarketOrderOptions): Promise<PendingMarketOrder>;
  protected override async placeOrder(pair: TradingPair, options: OrderOptions) {
    const rules = await this.getTradingRules(pair);
    const isCounterSized = options.type === OrderType.MARKET && options.sizeInCounter;

    let size: Big;

    if (isCounterSized) {
      assert.ok(options.side === OrderSide.BUY, 'BrokerMock only supports counter-sized (notional) MARKET BUY orders');
      size = this.#applyNotionalTradingRules(new Big(options.size), rules);
    } else {
      const validated = this.#applyTradingRules(new Big(options.size), options, rules);
      assert.ok(validated, `Order size "${options.size}" violates the trading rules`);
      size = validated;
    }

    const orderId = String(this.#nextOrderId++);

    // Validate balance and put amount on hold
    if (options.side === OrderSide.BUY) {
      let counterNeeded: Big;
      if (options.type === OrderType.LIMIT) {
        const price = this.#roundDownToIncrement(new Big(options.price), new Big(rules.counter_increment));
        counterNeeded = size.mul(price);
        // Add estimated fee
        const feeRate = this.#getFeeRateSync(options.type);
        counterNeeded = counterNeeded.plus(counterNeeded.mul(feeRate));
      } else if (options.sizeInCounter) {
        // Notional market order: the size IS the full counter spend, fee included.
        counterNeeded = size;
      } else {
        // Market order, best-effort: hold based on current candle price if available.
        const estimatedPrice = this.#currentCandle ? new Big(this.#currentCandle.close) : new Big(0);
        counterNeeded = size.mul(estimatedPrice);
        const feeRate = this.#getFeeRateSync(options.type);
        counterNeeded = counterNeeded.plus(counterNeeded.mul(feeRate));
      }

      this.#holdBalance(pair.counter, counterNeeded);
      this.#orderHolds.set(orderId, {amount: counterNeeded, currency: pair.counter});
    } else {
      this.#holdBalance(pair.base, size);
      this.#orderHolds.set(orderId, {amount: size, currency: pair.base});
    }

    if (options.type === OrderType.LIMIT) {
      const price = this.#roundDownToIncrement(new Big(options.price), new Big(rules.counter_increment));
      const pending: PendingLimitOrder = {
        id: orderId,
        pair,
        price: price.toFixed(),
        side: options.side,
        size: size.toFixed(),
        type: OrderType.LIMIT,
      };
      this.#pendingOrders.push(pending);
      return pending;
    }

    const pending: PendingMarketOrder = {
      id: orderId,
      pair,
      side: options.side,
      size: size.toFixed(),
      sizeInCounter: options.sizeInCounter,
      type: OrderType.MARKET,
    };
    this.#pendingOrders.push(pending);
    return pending;
  }

  /**
   * Rule enforcement for counter-sized (notional) orders. The base quantity is only known
   * at fill time, so the base minimum is checked against an estimate from the current
   * candle — mirroring a real broker rejecting an order that is too small to execute.
   */
  #applyNotionalTradingRules(counterAmount: Big, rules: TradingRules) {
    const size = this.#roundDownToIncrement(counterAmount, new Big(rules.counter_increment));
    assert.ok(
      size.gte(rules.counter_min_size),
      `Notional size "${size.toFixed()}" is below the minimum of "${rules.counter_min_size}"`
    );

    if (this.#currentCandle) {
      const estimatedPrice = new Big(this.#currentCandle.close);
      if (estimatedPrice.gt(0)) {
        const feeRate = this.#getFeeRateSync(OrderType.MARKET);
        const estimatedBase = size.div(new Big(1).plus(feeRate)).div(estimatedPrice);
        assert.ok(
          estimatedBase.gte(rules.base_min_size),
          `Notional size "${size.toFixed()}" buys an estimated "${estimatedBase.toFixed()}" base units, below the minimum of "${rules.base_min_size}"`
        );
      }
    }

    return size;
  }

  #applyTradingRules(size: Big, options: OrderOptions, rules: TradingRules) {
    const baseIncrement = new Big(rules.base_increment);
    const baseMinSize = new Big(rules.base_min_size);
    const counterMinSize = new Big(rules.counter_min_size);

    size = this.#roundDownToIncrement(size, baseIncrement);

    if (size.lt(baseMinSize)) {
      return null;
    }

    // Check minimum notional
    if (options.type === OrderType.LIMIT) {
      const counterIncrement = new Big(rules.counter_increment);
      const price = this.#roundDownToIncrement(new Big(options.price), counterIncrement);
      const notional = size.mul(price);
      if (notional.lt(counterMinSize)) {
        return null;
      }
    }

    return size;
  }

  #roundDownToIncrement(value: Big, increment: Big) {
    return value.div(increment).round(0, Big.roundDown).mul(increment);
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

  #getBalance(currency: string) {
    let balance = this.#balances.get(currency);
    if (!balance) {
      balance = {available: new Big(0), hold: new Big(0)};
      this.#balances.set(currency, balance);
    }
    return balance;
  }

  #holdBalance(currency: string, amount: Big) {
    const balance = this.#getBalance(currency);
    if (balance.available.lt(amount)) {
      throw new Error(
        `Insufficient ${currency} balance: need ${amount.toFixed()}, available ${balance.available.toFixed()}`
      );
    }
    balance.available = balance.available.minus(amount);
    balance.hold = balance.hold.plus(amount);
  }

  #releaseHold(currency: string, amount: Big) {
    const balance = this.#getBalance(currency);
    // Release up to what's on hold (may differ from original hold due to price improvement)
    const releaseAmount = amount.gt(balance.hold) ? balance.hold : amount;
    balance.hold = balance.hold.minus(releaseAmount);
  }

  #addAvailable(currency: string, amount: Big) {
    const balance = this.#getBalance(currency);
    balance.available = balance.available.plus(amount);
  }

  async listBalances() {
    const balances: Balance[] = [];
    for (const [currency, balance] of this.#balances) {
      balances.push({
        available: balance.available.toFixed(),
        currency,
        hold: balance.hold.toFixed(),
        position: OrderPosition.LONG,
      });
    }
    return balances;
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
    if (hold) {
      this.#releaseHold(hold.currency, hold.amount);
      this.#addAvailable(hold.currency, hold.amount);
      this.#orderHolds.delete(orderId);
    }
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

  async getTime() {
    return this.#currentCandle?.openTimeInISO ?? new Date().toISOString();
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
