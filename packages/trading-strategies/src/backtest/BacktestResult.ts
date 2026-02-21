import type {ExchangeOrderSide} from '@typedtrader/exchange';
import type Big from 'big.js';
import type {StrategyAdvice} from '../strategy/StrategyAdvice.js';

export interface BacktestTrade {
  /** The advice that triggered this trade. */
  advice: StrategyAdvice;
  /** The fee paid for this trade (in counter currency). */
  fee: Big;
  /** The ISO timestamp of the candle that triggered this trade. */
  openTimeInISO: string;
  /** The price at which the trade was executed (in counter currency per unit of base). */
  price: Big;
  /** Whether this was a buy or sell order. */
  side: ExchangeOrderSide;
  /** The quantity of the base asset traded. */
  size: Big;
}

export interface BacktestPerformanceSummary {
  /** What you'd earn just holding from first to last candle, as a percentage. */
  buyAndHoldReturnPercentage: Big;
  /** Final portfolio value in counter currency (base * lastClose + counter). */
  finalPortfolioValue: Big;
  /** Initial portfolio value in counter currency (base * lastClose + counter). */
  initialPortfolioValue: Big;
  /** Longest consecutive losing streak (round-trip cycles). */
  maxLossStreak: number;
  /** Longest consecutive winning streak (round-trip cycles). */
  maxWinStreak: number;
  /** Return on investment as a percentage (e.g. "12.5" means 12.5%). */
  returnPercentage: Big;
  /** Total number of trades (buys + sells). */
  totalTrades: number;
  /** Ratio of profitable round-trip cycles (buy followed by sell at a higher effective price). */
  winRate: Big;
}

export interface BacktestResult {
  /** Final amount of the base asset after the backtest. */
  finalBaseBalance: Big;
  /** Final amount of the counter asset after the backtest. */
  finalCounterBalance: Big;
  /** Initial amount of the base asset before the backtest. */
  initialBaseBalance: Big;
  /** Initial amount of the counter asset before the backtest. */
  initialCounterBalance: Big;
  /** Aggregated performance summary for the entire backtest run. */
  performance: BacktestPerformanceSummary;
  /** Profit or loss in counter currency. Compares the final portfolio value to the initial one, using the last candle's close price. */
  profitOrLoss: Big;
  /** Total fees paid across all trades (in counter currency). */
  totalFees: Big;
  /** Number of candles processed. */
  totalCandles: number;
  /** All trades executed during the backtest. */
  trades: BacktestTrade[];
}
