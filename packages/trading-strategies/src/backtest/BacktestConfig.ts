import type {ExchangeCandle, ExchangeMock, TradingPair} from '@typedtrader/exchange';
import type {Strategy} from '../strategy/Strategy.js';

export interface BacktestConfig {
  /** The candle data to run through the strategy (in chronological order). */
  candles: ExchangeCandle[];
  /** The mock exchange instance that handles order matching, balance tracking, and fee calculation. */
  exchange: ExchangeMock;
  /** The strategy instance to backtest. */
  strategy: Strategy;
  /** The trading pair, e.g. BTC/USD or TSLA/USD. */
  tradingPair: TradingPair;
}
