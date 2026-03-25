import type Big from 'big.js';
import type {BigSource} from 'big.js';
import type {BatchedCandle, OneMinuteBatchedCandle} from '../candle/BatchedCandle.js';
import {
  type ExchangeFeeRate,
  type ExchangeFill,
  ExchangeOrderSide,
  ExchangeOrderType,
  type ExchangePendingOrder,
  type ExchangeTradingRules,
} from '../exchange/Exchange.js';
import type {Exchange} from '../exchange/Exchange.js';
import type {TradingPair} from '../exchange/TradingPair.js';

export interface TradingSessionStrategy {
  onCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void>;
  onFill?(fill: ExchangeFill, state: TradingSessionState): Promise<void>;
}

type OrderAdviceBase = {
  reason?: string;
};

type MarketBuyBaseAdvice = OrderAdviceBase & {
  type: ExchangeOrderType.MARKET;
  side: ExchangeOrderSide.BUY;
  amountIn: 'base';
  /** Must be explicit — cannot derive base quantity from null without a price */
  amount: BigSource;
};

type MarketBuyCounterAdvice = OrderAdviceBase & {
  type: ExchangeOrderType.MARKET;
  side: ExchangeOrderSide.BUY;
  amountIn: 'counter';
  /** null = use all available counter balance */
  amount: BigSource | null;
};

type MarketSellAdvice = OrderAdviceBase & {
  type: ExchangeOrderType.MARKET;
  side: ExchangeOrderSide.SELL;
  amountIn: 'base' | 'counter';
  /** null = sell all available base */
  amount: BigSource | null;
};

export type MarketOrderAdvice = MarketBuyBaseAdvice | MarketBuyCounterAdvice | MarketSellAdvice;

export type LimitOrderAdvice = OrderAdviceBase & {
  type: ExchangeOrderType.LIMIT;
  side: ExchangeOrderSide;
  amountIn: 'base';
  /** null = use all available balance */
  amount: BigSource | null;
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

export interface TradingSessionOptions {
  exchange: Exchange;
  pair: TradingPair;
  strategy: TradingSessionStrategy;
  /** Candle interval in milliseconds */
  candleInterval: number;
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
