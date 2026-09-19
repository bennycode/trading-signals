import type {Candle, BrokerMock, MarketDataSource, TradingPair} from '@typedtrader/exchange';
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
   * History served to `strategy.init()` before the first candle, the way a live session serves its
   * broker. Only candles that closed before the first backtest candle opens reach `init`, so a
   * strategy cannot warm up on the candles it is about to be tested on. Defaults to no history.
   */
  warmup?: Pick<MarketDataSource, 'getRecentCandles'>;
}
