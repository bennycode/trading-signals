import type {ExchangeCandle, ExchangeFeeRate, ExchangeTradingRules, TradingPair} from '@typedtrader/exchange';
import type Big from 'big.js';
import type {Strategy} from '../strategy/Strategy.js';

export interface BacktestConfig {
  /** The candle data to run through the strategy (in chronological order). */
  candles: ExchangeCandle[];
  /** Fee rates for limit (maker) and market (taker) orders. Uses the ExchangeFeeRate from the exchange package. */
  feeRates: ExchangeFeeRate;
  /** Initial amount of the base asset (e.g., BTC, TSLA). */
  initialBaseBalance: Big;
  /** Initial amount of the counter asset (e.g., USD, EUR). */
  initialCounterBalance: Big;
  /** The strategy instance to backtest. */
  strategy: Strategy;
  /** The trading pair, e.g. BTC/USD or TSLA/USD. */
  tradingPair: TradingPair;
  /** Optional trading rules with minimum sizes and tick increments. When provided, trades violating these rules are skipped. */
  tradingRules?: ExchangeTradingRules;
}
