import type {CurrencyPair} from './CurrencyPair.js';
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
  /** Bucket start time in simplified extended ISO 8601 format */
  openTimeInISO: z.string(),
  /** Bucket start time converted to milliseconds */
  openTimeInMillis: z.number(),
  /** Candle size in milliseconds */
  sizeInMillis: z.number(),
});

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
  pair: CurrencyPair;
  position: ExchangeOrderPosition;
  price: string;
  side: ExchangeOrderSide;
  /** Total order size in base currency */
  size: string;
}

export interface ExchangePendingOrderBase {
  id: string;
  pair: CurrencyPair;
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
export abstract class Exchange {
  constructor(public loggerName: string) {}

  /**
   * Get candles within a specified time period.
   */
  abstract getCandles(pair: CurrencyPair, request: ExchangeCandleImportRequest): Promise<ExchangeCandle[]>;

  /**
   * Returns an identifiable name for the exchange.
   */
  abstract getName(): string;

  /**
   * Get the exchange's time in ISO 8601 format. The timezone is always zero UTC offset, as denoted by the suffix "Z",
   * i.e. "2020-09-11T14:04:33.769Z".
   */
  abstract getTime(): Promise<string>;
}
