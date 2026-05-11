import Big from 'big.js';
import {EventEmitter} from 'node:events';
import type {TradingPair} from './TradingPair.js';
import {z} from 'zod';

export const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

interface OrderBase {
  side: OrderSide;
  size: string;
  type: OrderType;
}

export const CandleBaseSchema = z.object({
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

export type CandleBase = z.infer<typeof CandleBaseSchema>;

export const OrderType = {
  /** Maker */
  LIMIT: 'LIMIT',
  /** Taker */
  MARKET: 'MARKET',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const CandleSchema = z
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
  .merge(CandleBaseSchema);

export type Candle = z.infer<typeof CandleSchema>;

export interface CandleImportRequest {
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
export interface FeeRate {
  /** The maker commission: When you put in a limit order on an exchange that doesn't fill immediately, it adds to the available orders for that stock. To attract more traders, the exchange may offer a lower fee when adding to the order book. */
  LIMIT: Big;
  /** The taker commission: Market orders are usually filled immediately, but they reduce available liquidity on an order book, which isn't good for exchanges. To prevent this, exchanges usually have higher taker fees than maker fees. */
  MARKET: Big;
  /**
   * Per-leg rate charged when the account currency differs from `pair.counter` and the
   * broker auto-converts. Undefined / zero when no conversion happens. The name matches
   * Trading212's tax line `CURRENCY_CONVERSION_FEE` so post-trade fees and pre-trade
   * estimates speak the same vocabulary.
   */
  CURRENCY_CONVERSION_FEE?: Big;
}

export const OrderPosition = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;
export type OrderPosition = (typeof OrderPosition)[keyof typeof OrderPosition];

export interface Fill {
  /** Date in ISO 8601 format */
  created_at: string;
  /** Total fee in fee asset */
  fee: string;
  feeAsset: string;
  order_id: string;
  pair: TradingPair;
  position: OrderPosition;
  price: string;
  side: OrderSide;
  /** Total order size in base currency */
  size: string;
}

export interface ExchangePendingOrderBase {
  id: string;
  pair: TradingPair;
  side: OrderSide;
  size: string;
  type: OrderType;
}

export interface PendingLimitOrder extends ExchangePendingOrderBase {
  price: string;
  type: 'LIMIT';
}

export interface PendingMarketOrder extends ExchangePendingOrderBase {
  /** Market orders don't have a price. */
  type: 'MARKET';
}

/**
 * Example: SHOP/USD
 * - Buy: "sizeInCounter": true with "size": 200 means "I want to buy as much as I can for a total amount of 200 USD (notional)
 * - Sell: "sizeInCounter": true with "size": 200 means "I want to sell as much as possible, so I get 200 USD (notional)
 * - Sell: "sizeInCounter": false with "size": 200 means "I want to sell 200 stocks for whatever is the current price (quantitative)
 * - Buy: "sizeInCounter": false with "size": 200 means "I want to buy 200 stocks for whatever is the current price on the exchange (quantitative)
 */
export interface MarketOrderOptions extends OrderBase {
  sizeInCounter: boolean;

  type: 'MARKET';
}

export interface LimitOrderOptions extends OrderBase {
  price: string;

  sizeInCounter: false;
  type: 'LIMIT';
}

export type OrderOptions = MarketOrderOptions | LimitOrderOptions;

export type PendingOrder = PendingLimitOrder | PendingMarketOrder;

export interface Balance {
  /** How much of the position is available */
  available: string;
  /** Asset/Symbol, Examples: "BTC", "EUR" or "TSLA" */
  currency: string;
  /** How much of the position is in transit (i.e. part of an order that has to be filled) */
  hold: string;
  /** Is it a long or short position? */
  position: OrderPosition;
}

export interface ExchangeAvailableBalance {
  base: Big;
  counter: Big;
}

export interface TradingRules {
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

export abstract class Broker extends EventEmitter {
  loggerName: string;

  constructor(loggerName: string) {
    super();
    this.loggerName = loggerName;
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
  ): OrderSide {
    const currentBaseWorthInCounter = new Big(baseBalance).mul(priceInCounter);
    const currentCounterWorthInCounter = new Big(counterBalance);
    if (currentBaseWorthInCounter.gt(currentCounterWorthInCounter)) {
      return OrderSide.BUY;
    }
    return OrderSide.SELL;
  }

  /**
   * Lists all positions on your account.
   *
   * Example:
   * [{ available: '548.20', currency: 'EUR', hold: '0.00000000' }]
   */
  abstract listBalances(): Promise<Balance[]>;

  /**
   * Cancel pending orders.
   *
   * @param pair - Trading pair
   * @returns The IDs of all canceled orders
   */
  abstract cancelOpenOrders(pair: TradingPair): Promise<string[]>;

  abstract cancelOrderById(pair: TradingPair, orderId: string): Promise<void>;

  /**
   * Get all open (unfilled) orders for a pair.
   */
  abstract getOpenOrders(pair: TradingPair): Promise<PendingOrder[]>;

  /**
   * Find the last filled order for a pair/symbol.
   */
  async getLatestFill(pair: TradingPair, side: OrderSide): Promise<Fill | undefined> {
    const fills = await this.getFills(pair);
    const fill = fills.find(fill => fill.side === side);

    if (fill) {
      return fill;
    }

    return undefined;
  }

  /**
   * Get all fills. Most recent being the first item in the returned array.
   *
   * @param pair - Trading pair
   */
  abstract getFills(pair: TradingPair): Promise<Fill[]>;

  /**
   * Returns a filled order (merged when an order got split into several fills) and `undefined` if the order is not yet
   * filled.
   *
   * @param pair - Trading pair
   * @param orderId - Order ID to look up
   */
  abstract getFillByOrderId(pair: TradingPair, orderId: string): Promise<Fill | undefined>;

  /**
   * Subscribe to real-time order fill updates via WebSocket.
   * Emits Fill objects via EventEmitter with the returned topicId as the event name.
   *
   * @returns The generated topicId (UUID) for this subscription
   */
  abstract watchOrders(): Promise<string>;

  /**
   * Unsubscribe from real-time order fill updates.
   *
   * @param topicId - The subscription identifier to unsubscribe
   */
  abstract unwatchOrders(topicId: string): void;

  abstract getTradingRules(pair: TradingPair): Promise<TradingRules>;

  /**
   * Returns the trading fees for a specific pair/symbol.
   *
   * @see https://www.investopedia.com/articles/active-trading/042414/what-makertaker-fees-mean-you.asp
   */
  abstract getFeeRates(pair: TradingPair): Promise<FeeRate>;

  /**
   * Returns the fee for a specific type of order.
   */
  async getFeeRate(pair: TradingPair, orderType: OrderType): Promise<Big> {
    const feeRate = await this.getFeeRates(pair);
    return feeRate[orderType];
  }

  /**
   * Estimate the per-leg fee for a single order before placing it. Strategies use this to
   * decide whether an expected price move covers round-trip costs. The estimate combines
   * the order-type commission rate and (when applicable) the currency-conversion rate.
   *
   * `feeAsset` is the currency the fee will actually be debited in — typically the account
   * currency, which can differ from `pair.counter` on cross-currency accounts.
   *
   * Returns the *expected* fee. Actual realised fees come back on `Fill.fee` after the
   * order executes and may differ slightly (broker-side spreads, FX rate variation).
   */
  async estimateFee(
    pair: TradingPair,
    orderType: OrderType,
    notional: Big
  ): Promise<{commission: Big; currencyConversion: Big; total: Big; feeAsset: string}> {
    const rates = await this.getFeeRates(pair);
    const commission = notional.times(rates[orderType]);
    const conversionRate = rates.CURRENCY_CONVERSION_FEE;
    const currencyConversion = conversionRate ? notional.times(conversionRate) : new Big(0);
    return {
      commission,
      currencyConversion,
      feeAsset: await this.getFeeAsset(pair),
      total: commission.plus(currencyConversion),
    };
  }

  /**
   * The currency in which broker fees are debited. Defaults to `pair.counter`; brokers
   * with cross-currency accounts (e.g. Trading212 EUR account trading USD instruments)
   * override this to return the account currency.
   */
  protected async getFeeAsset(pair: TradingPair): Promise<string> {
    return pair.counter;
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
        position: OrderPosition.LONG,
      };
    }

    if (!counterBalance) {
      counterBalance = {
        available: '0',
        currency: pair.counter,
        hold: '0',
        position: OrderPosition.LONG,
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
    options: LimitOrderOptions
  ): Promise<PendingLimitOrder>;
  protected abstract placeOrder(
    pair: TradingPair,
    options: MarketOrderOptions
  ): Promise<PendingMarketOrder>;
  protected abstract placeOrder(pair: TradingPair, options: OrderOptions): Promise<PendingOrder>;

  /**
   * Places a LIMIT order.
   * @see https://www.investopedia.com/terms/l/limitorder.asp
   */
  placeLimitOrder(
    pair: TradingPair,
    options: Omit<LimitOrderOptions, 'type' | 'sizeInCounter'>
  ): Promise<PendingLimitOrder> {
    return this.placeOrder(pair, {
      price: options.price,
      side: options.side,
      size: options.size,
      sizeInCounter: false,
      type: OrderType.LIMIT,
    });
  }

  /**
   * Places a MARKET order.
   * @see https://www.investopedia.com/terms/m/marketorder.asp
   */
  placeMarketOrder(
    pair: TradingPair,
    options: Omit<MarketOrderOptions, 'type'>
  ): Promise<PendingMarketOrder> {
    return this.placeOrder(pair, {
      side: options.side,
      size: options.size,
      sizeInCounter: options.sizeInCounter,
      type: OrderType.MARKET,
    });
  }

  /**
   * Disconnects the client from any pending connection with the exchange (mostly open WebSockets).
   */
  abstract disconnect(): void;

  /**
   * Returns an identifiable name for the exchange.
   */
  abstract getName(): string;

  /**
   * Get the smallest supported candle interval in milliseconds.
   */
  abstract getSmallestInterval(): number;
}
