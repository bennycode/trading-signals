import type Big from 'big.js';
import type {BigSource} from 'big.js';
import type {EventEmitter} from 'node:events';
import type {BatchedCandle, OneMinuteBatchedCandle} from '../candle/BatchedCandle.js';
import type {OrderSide} from '../broker/Broker.js';
import type {
  Candle,
  CandleImportRequest,
  ExchangeAvailableBalance,
  FeeRate,
  Fill,
  LimitOrderOptions,
  MarketOrderOptions,
  PendingLimitOrder,
  PendingMarketOrder,
  PendingOrder,
  TradingRules,
} from '../broker/Broker.js';
import type {TradingPair} from '../broker/TradingPair.js';

/**
 * Fetches historical candles for the session's pair — a thin bind over the broker's `getCandles`,
 * handed to a strategy's {@link TradingSessionStrategy.init} so it can warm up its indicators from
 * a window of history it chooses.
 */
export type FetchHistoricalCandles = (request: CandleImportRequest) => Promise<Candle[]>;

export interface TradingSessionStrategy {
  /**
   * Optional warm-up hook called once by the session on `start()`, before any live candle, so the
   * strategy can pre-seed its indicators from history (e.g. fetch daily candles to warm an ATR
   * instead of sitting unprotected through the live warm-up period).
   */
  init?(fetchCandles: FetchHistoricalCandles): Promise<void>;
  onCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void>;
  onFill?(fill: Fill, state: TradingSessionState): Promise<void>;
  /**
   * Called after `onFill` once the session determines that one of the strategy's
   * own orders is fully filled. The strategy receives the pending order the session
   * placed on its behalf, which it can compare by reference or side without having
   * to match raw exchange order ids from the fill.
   */
  onOrderFilled?(order: PendingOrder, state: TradingSessionState): Promise<void>;
  /**
   * Set by the `TradingSession` when the strategy is attached. Strategies call it to
   * surface a user-facing message (re-emitted as a `'message'` event by the session,
   * which downstream consumers like `StrategyMonitor` forward to the user). Strategies
   * are responsible for not being chatty — every call reaches the user.
   */
  onMessage?: (text: string) => void;
}

/** Use as `amount` in an `OrderAdvice` to use the full available balance. */
export const AllAvailableAmount = 'ALL_AVAILABLE_AMOUNT' as const;
type AllAvailableAmount = typeof AllAvailableAmount;

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
  side: OrderSide;
  amountIn: 'base';
  amount: BigSource | AllAvailableAmount;
  price: BigSource;
};

export type OrderAdvice = MarketOrderAdvice | LimitOrderAdvice;

export interface TradingSessionState {
  readonly baseBalance: Big;
  readonly counterBalance: Big;
  readonly lastOrderSide?: OrderSide;
  readonly tradingRules: TradingRules;
  readonly feeRates: FeeRate;
}

export interface TradingSessionBroker extends Pick<EventEmitter, 'on'> {
  cancelOpenOrders(pair: TradingPair): Promise<string[]>;
  getAvailableBalances(pair: TradingPair): Promise<ExchangeAvailableBalance>;
  getCandles(pair: TradingPair, request: CandleImportRequest): Promise<Candle[]>;
  getFeeRates(pair: TradingPair): Promise<FeeRate>;
  getFills(pair: TradingPair): Promise<Fill[]>;
  getOpenOrders(pair: TradingPair): Promise<PendingOrder[]>;
  getTradingRules(pair: TradingPair): Promise<TradingRules>;
  placeLimitOrder(
    pair: TradingPair,
    options: Omit<LimitOrderOptions, 'type' | 'sizeInCounter'>
  ): Promise<PendingLimitOrder>;
  placeMarketOrder(pair: TradingPair, options: Omit<MarketOrderOptions, 'type'>): Promise<PendingMarketOrder>;
  unwatchCandles(topicId: string): void;
  unwatchOrders(topicId: string): void;
  watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string>;
  watchOrders(): Promise<string>;
}

export interface TradingSessionOptions {
  broker: TradingSessionBroker;
  pair: TradingPair;
  strategy: TradingSessionStrategy;
}

export type TradingSessionEventMap = {
  advice: [OrderAdvice];
  candle: [BatchedCandle];
  error: [Error];
  fill: [Fill];
  message: [string];
  order: [PendingOrder];
  orderFilled: [PendingOrder];
  started: [];
  stopped: [];
};
