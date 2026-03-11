import type {ExchangeCandle, ExchangeMock, TradingPair, TradingSessionStrategy} from '@typedtrader/exchange';

export interface BacktestConfig {
  /** The candle data to run through the strategy (in chronological order). */
  candles: ExchangeCandle[];
  /** The mock exchange instance that handles order matching, balance tracking, and fee calculation. */
  exchange: ExchangeMock;
  /** The strategy instance to backtest. */
  strategy: TradingSessionStrategy;
  /** The trading pair, e.g. BTC/USD or TSLA/USD. */
  tradingPair: TradingPair;
}
