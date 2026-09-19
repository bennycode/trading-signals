import type {Candle, BrokerMock, TradingPair} from '@typedtrader/exchange';
import type {TradingSessionStrategy} from '../trader/index.js';

export interface BacktestConfig {
  /** The candle data to run through the strategy (in chronological order). */
  candles: Candle[];
  /** The mock exchange instance that handles order matching, balance tracking, and fee calculation. */
  broker: BrokerMock;
  /** The strategy instance to backtest. */
  strategy: TradingSessionStrategy;
  /** The trading pair, e.g. BTC/USD or TSLA/USD. */
  tradingPair: TradingPair;
}
