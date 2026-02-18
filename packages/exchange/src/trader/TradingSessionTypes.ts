import type Big from 'big.js';
import type {BigSource} from 'big.js';
import type {BatchedCandle} from '../candle/BatchedCandle.js';
import type {
  ExchangeFeeRate,
  ExchangeFill,
  ExchangeOrderSide,
  ExchangeOrderType,
  ExchangePendingOrder,
  ExchangeTradingRules,
} from '../core/Exchange.js';
import type {Exchange} from '../core/Exchange.js';
import type {TradingPair} from '../core/TradingPair.js';

export interface TradingSessionStrategy {
  onCandle(candle: BatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void>;
  onFill?(fill: ExchangeFill, state: TradingSessionState): Promise<void>;
}

export interface OrderAdvice {
  side: ExchangeOrderSide;
  type: ExchangeOrderType;
  /** null = use all available balance */
  amount: BigSource | null;
  amountInCounter: boolean;
  /** Required for LIMIT orders */
  price?: BigSource;
  reason?: string;
}

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
  /** Cancel open orders when stop() is called. Default: false */
  cancelOrdersOnStop?: boolean;
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
