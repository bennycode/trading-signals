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
  /**
   * History handed to `strategy.init()` via `getRecentCandles`, mirroring the warm-up a live
   * session gets. Must contain only candles from *before* the backtest window — the executor
   * deliberately never exposes the backtest candles themselves to `init`, otherwise a strategy
   * could peek at the future it is about to be tested on (lookahead bias).
   */
  warmupCandles?: Candle[];
}
