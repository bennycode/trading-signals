import type Big from 'big.js';
import type {BigSource} from 'big.js';
import type {EventEmitter} from 'node:events';
import type {
  BatchedCandle,
  Candle,
  Balance,
  ExchangeAvailableBalance,
  FeeRate,
  Fill,
  LimitOrderOptions,
  MarketDataSource,
  MarketOrderOptions,
  OneMinuteBatchedCandle,
  OrderSide,
  PendingLimitOrder,
  PendingMarketOrder,
  PendingOrder,
  TradingPair,
  TradingRules,
} from '@typedtrader/exchange';

export interface TradingSessionStrategy {
  init?(market: Pick<MarketDataSource, 'getRecentCandles'>, pair: TradingPair): Promise<void>;
  onCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void>;
  onFill?(fill: Fill, state: TradingSessionState): Promise<void>;
  /**
   * Set by the `TradingSession` when the strategy is attached. Strategies call it to
   * surface a user-facing message (re-emitted as a `'message'` event by the session,
   * which downstream consumers like `StrategyMonitor` forward to the user). Strategies
   * are responsible for not being chatty — every call reaches the user.
   */
  onMessage?: ((text: string) => void) | undefined;
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
  /**
   * Base currency held by orders of ours that have not filled. A strategy reading its position off
   * the balance has to count it: while a limit sell rests on the exchange the position is not
   * available to trade, but it has not been sold either.
   */
  readonly baseBalanceOnHold: Big;
  readonly counterBalance: Big;
  /**
   * Whether an order of ours is still on the book. A balance can show a purchase before its fill
   * notification arrives — Trading212 polls fills once a minute — and a strategy that adopted it
   * as a position found lying around would then count the same purchase again when the fill
   * finally lands.
   */
  readonly hasOutstandingOrder: boolean;
  readonly lastOrderSide?: OrderSide | undefined;
  readonly tradingRules: TradingRules;
  readonly feeRates: FeeRate;
}

export interface TradingSessionBroker extends Pick<EventEmitter, 'on'> {
  cancelOpenOrders(pair: TradingPair): Promise<string[]>;
  getAvailableBalances(pair: TradingPair): Promise<ExchangeAvailableBalance>;
  getFeeRates(pair: TradingPair): Promise<FeeRate>;
  getFills(pair: TradingPair): Promise<Fill[]>;
  getOpenOrders(pair: TradingPair): Promise<PendingOrder[]>;
  getRecentCandles(pair: TradingPair, count: number, intervalInMillis: number): Promise<Candle[]>;
  getTradingRules(pair: TradingPair): Promise<TradingRules>;
  /** Read for what an unfilled order is holding, which `getAvailableBalances` leaves out. */
  listBalances(): Promise<Balance[]>;
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
