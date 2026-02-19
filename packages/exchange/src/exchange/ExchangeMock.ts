import Big from 'big.js';
import {
  Exchange,
  type ExchangeBalance,
  type ExchangeCandle,
  type ExchangeCandleImportRequest,
  type ExchangeFeeRate,
  type ExchangeFill,
  type ExchangeLimitOrderOptions,
  type ExchangeMarketOrderOptions,
  type ExchangeOrderOptions,
  ExchangeOrderPosition,
  ExchangeOrderSide,
  ExchangeOrderType,
  type ExchangePendingLimitOrder,
  type ExchangePendingMarketOrder,
  type ExchangePendingOrder,
  type ExchangeTradingRules,
} from './Exchange.js';
import type {TradingPair} from './TradingPair.js';

export interface ExchangeMockBalance {
  available: Big;
  hold: Big;
}

export abstract class ExchangeMock extends Exchange {
  readonly #balances: Map<string, ExchangeMockBalance>;
  readonly #pendingOrders: ExchangePendingOrder[] = [];
  readonly #fills: ExchangeFill[] = [];
  #currentCandle: ExchangeCandle | undefined;
  #nextOrderId = 1;

  constructor(config: {balances: Map<string, ExchangeMockBalance>}) {
    super('ExchangeMock');
    this.#balances = config.balances;
  }

  abstract override getFeeRates(pair: TradingPair): Promise<ExchangeFeeRate>;
  abstract override getTradingRules(pair: TradingPair): Promise<ExchangeTradingRules>;
  abstract override getName(): string;
  abstract override getSmallestInterval(): number;
  /**
   * Matches pending orders against the given candle's price range and returns new fills.
   * Orders placed on candle N are not matched until candle N+1 (realistic 1-candle delay).
   */
  processCandle(candle: ExchangeCandle): ExchangeFill[] {
    this.#currentCandle = candle;
    const newFills: ExchangeFill[] = [];
    const remaining: ExchangePendingOrder[] = [];

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

    return newFills;
  }

  #tryMatch(order: ExchangePendingOrder, candle: ExchangeCandle): ExchangeFill | null {
    const pair = order.pair;
    const candleOpen = new Big(candle.open);
    const candleLow = new Big(candle.low);
    const candleHigh = new Big(candle.high);
    const size = new Big(order.size);

    let fillPrice: Big;

    if (order.type === ExchangeOrderType.MARKET) {
      // Market orders fill at candle open price
      fillPrice = candleOpen;
    } else {
      // Limit order
      const limitPrice = new Big(order.price);

      if (order.side === ExchangeOrderSide.BUY) {
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

    return {
      created_at: candle.openTimeInISO,
      fee: fee.toFixed(),
      feeAsset: pair.counter,
      order_id: order.id,
      pair,
      position: ExchangeOrderPosition.LONG,
      price: fillPrice.toFixed(),
      side: order.side,
      size: order.size,
    };
  }

  #applyFill(fill: ExchangeFill, order: ExchangePendingOrder): void {
    const size = new Big(fill.size);
    const price = new Big(fill.price);
    const fee = new Big(fill.fee);

    if (order.side === ExchangeOrderSide.BUY) {
      // Release counter hold, add base
      const counterCost = size.mul(price).plus(fee);
      this.#releaseHold(order.pair.counter, counterCost);
      this.#addAvailable(order.pair.base, size);
    } else {
      // Release base hold, add counter revenue
      this.#releaseHold(order.pair.base, size);
      const netRevenue = size.mul(price).minus(fee);
      this.#addAvailable(order.pair.counter, netRevenue);
    }

    this.#fills.push(fill);
  }

  protected override async placeOrder(
    pair: TradingPair,
    options: ExchangeLimitOrderOptions
  ): Promise<ExchangePendingLimitOrder>;
  protected override async placeOrder(
    pair: TradingPair,
    options: ExchangeMarketOrderOptions
  ): Promise<ExchangePendingMarketOrder>;
  protected override async placeOrder(pair: TradingPair, options: ExchangeOrderOptions): Promise<ExchangePendingOrder> {
    const rules = await this.getTradingRules(pair);
    const size = this.#applyTradingRules(new Big(options.size), options, rules);

    if (!size) {
      throw new Error(
        `Order rejected: size ${options.size} does not meet trading rules (min: ${rules.base_min_size}, increment: ${rules.base_increment})`
      );
    }

    // Validate balance and put amount on hold
    if (options.side === ExchangeOrderSide.BUY) {
      let counterNeeded: Big;
      if (options.type === ExchangeOrderType.LIMIT) {
        const price = this.#roundDownToIncrement(new Big(options.price), new Big(rules.counter_increment));
        counterNeeded = size.mul(price);
        // Add estimated fee
        const feeRate = this.#getFeeRateSync(options.type);
        counterNeeded = counterNeeded.plus(counterNeeded.mul(feeRate));
      } else {
        // Market order: we don't know the exact price yet, so hold the full counter amount if sizeInCounter
        if (options.sizeInCounter) {
          counterNeeded = new Big(options.size);
        } else {
          // Best-effort: hold based on current candle price if available
          const estimatedPrice = this.#currentCandle ? new Big(this.#currentCandle.close) : new Big(0);
          counterNeeded = size.mul(estimatedPrice);
          const feeRate = this.#getFeeRateSync(options.type);
          counterNeeded = counterNeeded.plus(counterNeeded.mul(feeRate));
        }
      }

      this.#holdBalance(pair.counter, counterNeeded);
    } else {
      this.#holdBalance(pair.base, size);
    }

    const orderId = String(this.#nextOrderId++);

    if (options.type === ExchangeOrderType.LIMIT) {
      const price = this.#roundDownToIncrement(new Big(options.price), new Big(rules.counter_increment));
      const pending: ExchangePendingLimitOrder = {
        id: orderId,
        pair,
        price: price.toFixed(),
        side: options.side,
        size: size.toFixed(),
        type: ExchangeOrderType.LIMIT,
      };
      this.#pendingOrders.push(pending);
      return pending;
    }

    const pending: ExchangePendingMarketOrder = {
      id: orderId,
      pair,
      side: options.side,
      size: size.toFixed(),
      type: ExchangeOrderType.MARKET,
    };
    this.#pendingOrders.push(pending);
    return pending;
  }

  #applyTradingRules(size: Big, options: ExchangeOrderOptions, rules: ExchangeTradingRules): Big | null {
    const baseIncrement = new Big(rules.base_increment);
    const baseMinSize = new Big(rules.base_min_size);
    const counterMinSize = new Big(rules.counter_min_size);

    size = this.#roundDownToIncrement(size, baseIncrement);

    if (size.lt(baseMinSize)) {
      return null;
    }

    // Check minimum notional
    if (options.type === ExchangeOrderType.LIMIT) {
      const counterIncrement = new Big(rules.counter_increment);
      const price = this.#roundDownToIncrement(new Big(options.price), counterIncrement);
      const notional = size.mul(price);
      if (notional.lt(counterMinSize)) {
        return null;
      }
    }

    return size;
  }

  #roundDownToIncrement(value: Big, increment: Big): Big {
    return value.div(increment).round(0, Big.roundDown).mul(increment);
  }

  /** Cached fee rates to avoid async in hot path */
  #cachedFeeRates: ExchangeFeeRate | undefined;

  setCachedFeeRates(rates: ExchangeFeeRate): void {
    this.#cachedFeeRates = rates;
  }

  #getFeeRateSync(orderType: ExchangeOrderType): Big {
    if (!this.#cachedFeeRates) {
      throw new Error('Fee rates not cached. Call setCachedFeeRates() before processing candles.');
    }
    return this.#cachedFeeRates[orderType];
  }

  #getBalance(currency: string): ExchangeMockBalance {
    let balance = this.#balances.get(currency);
    if (!balance) {
      balance = {available: new Big(0), hold: new Big(0)};
      this.#balances.set(currency, balance);
    }
    return balance;
  }

  #holdBalance(currency: string, amount: Big): void {
    const balance = this.#getBalance(currency);
    if (balance.available.lt(amount)) {
      throw new Error(
        `Insufficient ${currency} balance: need ${amount.toFixed()}, available ${balance.available.toFixed()}`
      );
    }
    balance.available = balance.available.minus(amount);
    balance.hold = balance.hold.plus(amount);
  }

  #releaseHold(currency: string, amount: Big): void {
    const balance = this.#getBalance(currency);
    // Release up to what's on hold (may differ from original hold due to price improvement)
    const releaseAmount = amount.gt(balance.hold) ? balance.hold : amount;
    balance.hold = balance.hold.minus(releaseAmount);
  }

  #addAvailable(currency: string, amount: Big): void {
    const balance = this.#getBalance(currency);
    balance.available = balance.available.plus(amount);
  }

  async listBalances(): Promise<ExchangeBalance[]> {
    const balances: ExchangeBalance[] = [];
    for (const [currency, balance] of this.#balances) {
      balances.push({
        available: balance.available.toFixed(),
        currency,
        hold: balance.hold.toFixed(),
        position: ExchangeOrderPosition.LONG,
      });
    }
    return balances;
  }

  async getFills(pair: TradingPair): Promise<ExchangeFill[]> {
    return this.#fills
      .filter(f => f.pair.base === pair.base && f.pair.counter === pair.counter)
      .slice()
      .reverse();
  }

  async getFillByOrderId(_pair: TradingPair, orderId: string): Promise<ExchangeFill | undefined> {
    return this.#fills.find(f => f.order_id === orderId);
  }

  async cancelOrderById(pair: TradingPair, orderId: string): Promise<void> {
    const index = this.#pendingOrders.findIndex(o => o.id === orderId);
    if (index === -1) {
      throw new Error(`Order ${orderId} not found`);
    }

    const order = this.#pendingOrders[index];
    this.#pendingOrders.splice(index, 1);

    // Release hold
    if (order.side === ExchangeOrderSide.BUY) {
      if (order.type === ExchangeOrderType.LIMIT) {
        const price = new Big(order.price);
        const counterAmount = new Big(order.size).mul(price);
        const feeRate = this.#getFeeRateSync(order.type);
        const totalHeld = counterAmount.plus(counterAmount.mul(feeRate));
        this.#releaseHold(pair.counter, totalHeld);
        this.#addAvailable(pair.counter, totalHeld);
      }
    } else {
      this.#releaseHold(pair.base, new Big(order.size));
      this.#addAvailable(pair.base, new Big(order.size));
    }
  }

  async cancelOpenOrders(pair: TradingPair): Promise<string[]> {
    const toCancel = this.#pendingOrders.filter(
      o => o.pair.base === pair.base && o.pair.counter === pair.counter
    );
    const canceledIds: string[] = [];
    for (const order of toCancel) {
      await this.cancelOrderById(pair, order.id);
      canceledIds.push(order.id);
    }
    return canceledIds;
  }

  async getLatestCandle(_pair: TradingPair, _intervalInMillis: number): Promise<ExchangeCandle> {
    if (!this.#currentCandle) {
      throw new Error('No candle has been processed yet');
    }
    return this.#currentCandle;
  }

  async getTime(): Promise<string> {
    return this.#currentCandle?.openTimeInISO ?? new Date().toISOString();
  }

  async getOpenOrders(pair: TradingPair): Promise<ExchangePendingOrder[]> {
    return this.#pendingOrders.filter(
      o => o.pair.base === pair.base && o.pair.counter === pair.counter
    );
  }

  async getCandles(_pair: TradingPair, _request: ExchangeCandleImportRequest): Promise<ExchangeCandle[]> {
    throw new Error('getCandles() is not supported in mock exchange');
  }

  async watchCandles(_pair: TradingPair, _intervalInMillis: number, _openTimeInISO: string): Promise<string> {
    throw new Error('watchCandles() is not supported in mock exchange');
  }

  unwatchCandles(_topicId: string): void {
    throw new Error('unwatchCandles() is not supported in mock exchange');
  }

  async watchOrders(): Promise<string> {
    throw new Error('watchOrders() is not supported in mock exchange');
  }

  unwatchOrders(_topicId: string): void {
    throw new Error('unwatchOrders() is not supported in mock exchange');
  }

  disconnect(): void {
    // No-op
  }

  getPendingOrders(): ExchangePendingOrder[] {
    return [...this.#pendingOrders];
  }
}
