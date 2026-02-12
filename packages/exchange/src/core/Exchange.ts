import Big from 'big.js';
import {EventEmitter} from 'node:events';
import type {TradingPair} from './TradingPair.js';
import {z} from 'zod';

export enum ExchangeOrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

interface ExchangeOrderBase {
  side: ExchangeOrderSide;
  size: string;
  type: ExchangeOrderType;
}

export const ExchangeCandleBaseSchema = z.object({
  /** ID of base asset */
  base: z.string(),

  /** ID of quote asset */
  counter: z.string(),

  /** True, if this candle is the latest / current candle from the exchange. This flag is good to know if a candle comes from a history import or not. */
  isLatest: z.boolean().optional(),
  /** Bucket start time in simplified extended ISO 8601 format */
  openTimeInISO: z.string(),
  /** Bucket start time converted to milliseconds (note: Coinbase Pro actually uses seconds) */
  openTimeInMillis: z.number(),
  /** Candle size in milliseconds */
  sizeInMillis: z.number(),
});

export type ExchangeCandleBase = z.infer<typeof ExchangeCandleBaseSchema>;

export enum ExchangeOrderType {
  /** Maker */
  LIMIT = 'LIMIT',
  /** Taker */
  MARKET = 'MARKET',
}

export const ExchangeCandleSchema = z
  .object({
    /** Closing price (last trade) during the candle interval */
    close: z.string(),
    /** Represents the minimum price that a seller was willing to take at the end of the candle */
    closeAsk: z.string().optional(),
    /** Highest price during the candle interval */
    high: z.string(),
    /** Represents the minimum price that a seller was willing to take at the peak of the candle */
    highAsk: z.string().optional(),
    /** Lowest price during the candle interval */
    low: z.string(),
    /** Represents the minimum price that a seller was willing to take at the bottom of the candle */
    lowAsk: z.string().optional(),
    /** Opening price (first trade) during the candle interval */
    open: z.string(),
    /** Represents the minimum price that a seller was willing to take at the beginning of the candle */
    openAsk: z.string().optional(),
    /** Amount of traded base currency during the candle interval */
    volume: z.string(),
  })
  .merge(ExchangeCandleBaseSchema);

export type ExchangeCandle = z.infer<typeof ExchangeCandleSchema>;

export interface ExchangeCandleImportRequest {
  /** Candle size in milliseconds, i.e. 60000 for 1 minute */
  intervalInMillis: number;
  /** Opening time of first candle (start) in ISO 8601 UTC timezone: '2021-01-15T01:00:00.000Z' */
  startTimeFirstCandle: string;
  /** Opening time of last candle (stop) in ISO 8601 UTC timezone: '2021-01-15T01:59:00.000Z' */
  startTimeLastCandle: string;
}

/**
 * A fee rate of "1" means 100%, "0.1" is 10%, "0.01" is 1%, ...
 *
 * @see https://www.investopedia.com/articles/active-trading/042414/what-makertaker-fees-mean-you.asp
 */
export interface ExchangeFeeRate {
  /** The maker commission: When you put in a limit order on an exchange that doesn't fill immediately, it adds to the available orders for that stock. To attract more traders, the exchange may offer a lower fee when adding to the order book. */
  [ExchangeOrderType.LIMIT]: Big;
  /** The taker commission: Market orders are usually filled immediately, but they reduce available liquidity on an order book, which isn't good for exchanges. To prevent this, exchanges usually have higher taker fees than maker fees. */
  [ExchangeOrderType.MARKET]: Big;
}

export enum ExchangeOrderPosition {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

export interface ExchangeFill {
  /** Date in ISO 8601 format */
  created_at: string;
  /** Total fee in fee asset */
  fee: string;
  feeAsset: string;
  order_id: string;
  pair: TradingPair;
  position: ExchangeOrderPosition;
  price: string;
  side: ExchangeOrderSide;
  /** Total order size in base currency */
  size: string;
}

export interface ExchangePendingOrderBase {
  id: string;
  pair: TradingPair;
  side: ExchangeOrderSide;
  size: string;
  type: ExchangeOrderType;
}

export interface ExchangePendingLimitOrder extends ExchangePendingOrderBase {
  price: string;
  type: ExchangeOrderType.LIMIT;
}

export interface ExchangePendingMarketOrder extends ExchangePendingOrderBase {
  /** Market orders don't have a price. */
  type: ExchangeOrderType.MARKET;
}

/**
 * Example: SHOP/USD
 * - Buy: "sizeInCounter": true with "size": 200 means "I want to buy as much as I can for a total amount of 200 USD (notional)
 * - Sell: "sizeInCounter": true with "size": 200 means "I want to sell as much as possible, so I get 200 USD (notional)
 * - Sell: "sizeInCounter": false with "size": 200 means "I want to sell 200 stocks for whatever is the current price (quantitative)
 * - Buy: "sizeInCounter": false with "size": 200 means "I want to buy 200 stocks for whatever is the current price on the exchange (quantitative)
 */
export interface ExchangeMarketOrderOptions extends ExchangeOrderBase {
  sizeInCounter: boolean;

  type: ExchangeOrderType.MARKET;
}

export interface ExchangeLimitOrderOptions extends ExchangeOrderBase {
  price: string;

  sizeInCounter: false;
  type: ExchangeOrderType.LIMIT;
}

export type ExchangeOrderOptions = ExchangeMarketOrderOptions | ExchangeLimitOrderOptions;

export type ExchangePendingOrder = ExchangePendingLimitOrder | ExchangePendingMarketOrder;

export interface ExchangeBalance {
  /** How much of the position is available */
  available: string;
  /** Asset/Symbol, Examples: "BTC", "EUR" or "TSLA" */
  currency: string;
  /** How much of the position is in transit (i.e. part of an order that has to be filled) */
  hold: string;
  /** Is it a long or short position? */
  position: ExchangeOrderPosition;
}

export interface ExchangeAvailableBalance {
  base: Big;
  counter: Big;
}

export interface ExchangeTradingRules {
  /** Steps in which the quantity can be incremented */
  base_increment: string;
  /** Maximum quantity that can be bought */
  base_max_size: string;
  /** Minimum quantity that can be bought */
  base_min_size: string;
  /** Steps in which the price can be incremented */
  counter_increment: string;
  /** Minimum total price */
  counter_min_size: string;
  pair: TradingPair;
}

export abstract class Exchange extends EventEmitter {
  constructor(public loggerName: string) {
    super();
  }

  /**
   * If there are no recently filled orders, this function can be used to assume if you have recently bought or sold an
   * asset by checking your account balance and current market price.
   *
   * @param baseBalance - Asset (i.e. "TSLA")
   * @param counterBalance - Balance that you used to buy the asset (i.e. "USD")
   * @param priceInCounter - Price of the asset
   */
  static toExchangeOrderSide(
    baseBalance: Big.BigSource,
    counterBalance: Big.BigSource,
    priceInCounter: Big.BigSource
  ): ExchangeOrderSide {
    const currentBaseWorthInCounter = new Big(baseBalance).mul(priceInCounter);
    const currentCounterWorthInCounter = new Big(counterBalance);
    if (currentBaseWorthInCounter.gt(currentCounterWorthInCounter)) {
      return ExchangeOrderSide.BUY;
    }
    return ExchangeOrderSide.SELL;
  }

  /**
   * Lists all positions on your account.
   *
   * Example:
   * [{ available: '548.20', currency: 'EUR', hold: '0.00000000' }]
   */
  abstract listBalances(): Promise<ExchangeBalance[]>;

  /**
   * Cancel pending orders.
   *
   * @param pair - Trading pair
   * @returns The IDs of all canceled orders
   */
  abstract cancelOpenOrders(pair: TradingPair): Promise<string[]>;

  abstract cancelOrderById(pair: TradingPair, orderId: string): Promise<void>;

  /**
   * Get candles within a specified time period.
   */
  abstract getCandles(pair: TradingPair, request: ExchangeCandleImportRequest): Promise<ExchangeCandle[]>;

  /**
   * Find the last filled order for a pair/symbol.
   */
  async getLatestFill(pair: TradingPair, side: ExchangeOrderSide): Promise<ExchangeFill | void> {
    const fills = await this.getFills(pair);
    const fill = fills.find(fill => fill.side === side);
    if (fill) {
      return this.getFillByOrderId(pair, fill.order_id);
    }
  }

  /**
   * Get the latest candle for a given pair and interval.
   * Uses the exchange's dedicated "latest" endpoint for efficiency.
   */
  abstract getLatestCandle(pair: TradingPair, intervalInMillis: number): Promise<ExchangeCandle>;

  /**
   * Get all fills. Most recent being the first item in the returned array.
   *
   * @param pair - Trading pair
   */
  abstract getFills(pair: TradingPair): Promise<ExchangeFill[]>;

  /**
   * Returns a filled order (merged when an order got split into several fills) and `undefined` if the order is not yet
   * filled.
   *
   * @param pair - Trading pair
   * @param orderId - Order ID to look up
   */
  abstract getFillByOrderId(pair: TradingPair, orderId: string): Promise<ExchangeFill | undefined>;

  /**
   * Subscribe to real-time candle updates via WebSocket.
   * Emits candles via EventEmitter with the returned topicId as the event name.
   *
   * @param pair - The trading pair to watch
   * @param intervalInMillis - Candle interval in milliseconds
   * @param openTimeInISO - Only emit candles newer than this time
   * @returns The generated topicId (UUID) for this subscription
   */
  abstract watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string>;

  /**
   * Unsubscribe from real-time candle updates.
   *
   * @param topicId - The subscription identifier to unsubscribe
   */
  abstract unwatchCandles(topicId: string): void;

  abstract getTradingRules(pair: TradingPair): Promise<ExchangeTradingRules>;

  /**
   * Returns the trading fees for a specific pair/symbol.
   *
   * @see https://www.investopedia.com/articles/active-trading/042414/what-makertaker-fees-mean-you.asp
   */
  abstract getFeeRates(pair: TradingPair): Promise<ExchangeFeeRate>;

  /**
   * Returns the fee for a specific type of order.
   */
  async getFeeRate(pair: TradingPair, orderType: ExchangeOrderType): Promise<Big> {
    const feeRate = await this.getFeeRates(pair);
    return feeRate[orderType];
  }

  /**
   * Returns the positions that your account is holding on the exchange.
   */
  async getAvailableBalances(pair: TradingPair): Promise<ExchangeAvailableBalance> {
    const balances = await this.listBalances();

    let baseBalance = balances.find(balance => balance.currency === pair.base);
    let counterBalance = balances.find(balance => balance.currency === pair.counter);

    if (!baseBalance) {
      baseBalance = {
        available: '0',
        currency: pair.base,
        hold: '0',
        position: ExchangeOrderPosition.LONG,
      };
    }

    if (!counterBalance) {
      counterBalance = {
        available: '0',
        currency: pair.counter,
        hold: '0',
        position: ExchangeOrderPosition.LONG,
      };
    }

    return {
      base: new Big(baseBalance.available),
      counter: new Big(counterBalance.available),
    };
  }

  /**
   * Get the exchange's time in ISO 8601 format. The timezone is always zero UTC offset, as denoted by the suffix "Z",
   * i.e. "2020-09-11T14:04:33.769Z".
   */
  abstract getTime(): Promise<string>;

  /**
   * Generic function to place an order.
   * @protected Please use `placeLimitOrder` or `placeMarketOrder`.
   */
  protected abstract placeOrder(
    pair: TradingPair,
    options: ExchangeLimitOrderOptions
  ): Promise<ExchangePendingLimitOrder>;
  protected abstract placeOrder(
    pair: TradingPair,
    options: ExchangeMarketOrderOptions
  ): Promise<ExchangePendingMarketOrder>;
  protected abstract placeOrder(pair: TradingPair, options: ExchangeOrderOptions): Promise<ExchangePendingOrder>;

  /**
   * Places a LIMIT order.
   * @see https://www.investopedia.com/terms/l/limitorder.asp
   */
  placeLimitOrder(
    pair: TradingPair,
    options: Omit<ExchangeLimitOrderOptions, 'type' | 'sizeInCounter'>
  ): Promise<ExchangePendingLimitOrder> {
    return this.placeOrder(pair, {
      price: options.price,
      side: options.side,
      size: options.size,
      sizeInCounter: false,
      type: ExchangeOrderType.LIMIT,
    });
  }

  /**
   * Places a MARKET order.
   * @see https://www.investopedia.com/terms/m/marketorder.asp
   */
  placeMarketOrder(
    pair: TradingPair,
    options: Omit<ExchangeMarketOrderOptions, 'type'>
  ): Promise<ExchangePendingMarketOrder> {
    return this.placeOrder(pair, {
      side: options.side,
      size: options.size,
      sizeInCounter: options.sizeInCounter,
      type: ExchangeOrderType.MARKET,
    });
  }

  /**
   * Disconnects the client from any pending connection with the exchange (mostly open WebSockets).
   */
  abstract disconnect(): void;

  abstract getTradingLink(pair: TradingPair): string;

  /**
   * Returns a link to the exchange rendered with Markdown syntax.
   */
  abstract getMarkdownLink(): string;

  /**
   * Returns an identifiable name for the exchange.
   */
  abstract getName(): string;

  /**
   * Get the smallest supported candle interval in milliseconds.
   */
  abstract getSmallestInterval(): number;
}
