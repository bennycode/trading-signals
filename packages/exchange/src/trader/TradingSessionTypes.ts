import type Big from 'big.js';
import type {BigSource} from 'big.js';
import type {EventEmitter} from 'node:events';
import type {BatchedCandle, OneMinuteBatchedCandle} from '../candle/BatchedCandle.js';
import {
  type ExchangeAvailableBalance,
  type ExchangeFeeRate,
  type ExchangeFill,
  type ExchangeLimitOrderOptions,
  type ExchangeMarketOrderOptions,
  ExchangeOrderSide,
  type ExchangePendingLimitOrder,
  type ExchangePendingMarketOrder,
  type ExchangePendingOrder,
  type ExchangeTradingRules,
} from '../exchange/Exchange.js';
import type {TradingPair} from '../exchange/TradingPair.js';

export interface TradingSessionStrategy {
  onCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void>;
  onFill?(fill: ExchangeFill, state: TradingSessionState): Promise<void>;
}

/** Use as `amount` in an `OrderAdvice` to use the full available balance. */
export const ALL_AVAILABLE_AMOUNT = 'ALL_AVAILABLE_AMOUNT' as const;
type AllAvailableAmount = typeof ALL_AVAILABLE_AMOUNT;

type OrderAdviceBase = {
  reason?: string;
};

type MarketBuyBaseAdvice = OrderAdviceBase & {
  type: 'MARKET';
  side: 'BUY';
  amountIn: 'base';
  /** Must be explicit — cannot derive base quantity from null without a price */
  amount: BigSource;
};

type MarketBuyCounterAdvice = OrderAdviceBase & {
  type: 'MARKET';
  side: 'BUY';
  amountIn: 'counter';
  amount: BigSource | AllAvailableAmount;
};

type MarketSellAdvice = OrderAdviceBase & {
  type: 'MARKET';
  side: 'SELL';
  amountIn: 'base' | 'counter';
  amount: BigSource | AllAvailableAmount;
};

export type MarketOrderAdvice = MarketBuyBaseAdvice | MarketBuyCounterAdvice | MarketSellAdvice;

export type LimitOrderAdvice = OrderAdviceBase & {
  type: 'LIMIT';
  side: ExchangeOrderSide;
  amountIn: 'base';
  amount: BigSource | AllAvailableAmount;
  price: BigSource;
};

export type OrderAdvice = MarketOrderAdvice | LimitOrderAdvice;

export interface TradingSessionState {
  readonly baseBalance: Big;
  readonly counterBalance: Big;
  readonly lastOrderSide?: ExchangeOrderSide;
  readonly tradingRules: ExchangeTradingRules;
  readonly feeRates: ExchangeFeeRate;
}

export interface TradingSessionExchange extends Pick<EventEmitter, 'on'> {
  cancelOpenOrders(pair: TradingPair): Promise<string[]>;
  getAvailableBalances(pair: TradingPair): Promise<ExchangeAvailableBalance>;
  getFeeRates(pair: TradingPair): Promise<ExchangeFeeRate>;
  getFills(pair: TradingPair): Promise<ExchangeFill[]>;
  getOpenOrders(pair: TradingPair): Promise<ExchangePendingOrder[]>;
  getTradingRules(pair: TradingPair): Promise<ExchangeTradingRules>;
  placeLimitOrder(
    pair: TradingPair,
    options: Omit<ExchangeLimitOrderOptions, 'type' | 'sizeInCounter'>
  ): Promise<ExchangePendingLimitOrder>;
  placeMarketOrder(
    pair: TradingPair,
    options: Omit<ExchangeMarketOrderOptions, 'type'>
  ): Promise<ExchangePendingMarketOrder>;
  unwatchCandles(topicId: string): void;
  unwatchOrders(topicId: string): void;
  watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string>;
  watchOrders(): Promise<string>;
}

export interface TradingSessionOptions {
  exchange: TradingSessionExchange;
  pair: TradingPair;
  strategy: TradingSessionStrategy;
}

export type TradingSessionEventMap = {
  advice: [OrderAdvice];
  candle: [BatchedCandle];
  error: [Error];
  fill: [ExchangeFill];
  order: [ExchangePendingOrder];
  started: [];
  stopped: [];
};
